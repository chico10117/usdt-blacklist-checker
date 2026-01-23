import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CheckRequestSchema } from "@/lib/validators";
import { readUsdtBlacklistStatusOnChain } from "@/lib/tron";
import { checkTronScanUsdtBlacklist } from "@/lib/tronscan";
import { checkOfacSanctions } from "@/lib/sanctions";
import { computeConfidencePercent, computeRiskScore, computeUsdtVolumeStats } from "@/lib/aml";
import { fetchTronScanAccountTag, fetchUsdtTrc20Transfers, fetchUsdtBalance } from "@/lib/tronscan";
import { computeTopInboundCounterparties } from "@/lib/exposure";
import { computeFlowHeuristics } from "@/lib/heuristics";
import { getOrSetCache, sha256Key } from "@/lib/cache";
import { classifyEntityFromTagsAndTransfers } from "@/lib/entity";

export const runtime = "nodejs";

type Evidence = {
  contractAddress: string;
  txHash?: string;
  timestampIso?: string;
  method?: string;
  raw?: string;
  fullHost?: string;
};

type CheckResult =
  | { ok: true; blacklisted: boolean; evidence?: Evidence }
  | { ok: false; blacklisted: false; error: string };

type AnalyzeResponse = {
  address: string;
  isValid: boolean;
  access: { authenticated: boolean };
  balance?: { ok: true; usdt: string; usdtBaseUnits: string } | { ok: false; error: string };
  checks: {
    tronscan: CheckResult;
    onchain: CheckResult;
    sanctions: ReturnType<typeof checkOfacSanctions>;
    entity:
      | {
          ok: true;
          kind: "exchange" | "particular" | "unknown";
          label: string;
          confidence: number; // 0..1
          reasons: string[];
          subjectTag?: { publicTag?: string; blueTag?: string; greyTag?: string; redTag?: string };
          outbound?: {
            totalOutboundAmount: string;
            exchangeTaggedShare: number;
            top: Array<{
              address: string;
              outboundAmount: string;
              outboundTxCount: number;
              publicTag?: string;
              isExchangeTagged: boolean;
            }>;
          };
        }
      | { ok: false; error: string };
    volume: { ok: true; stats: ReturnType<typeof computeUsdtVolumeStats>; notices: string[] } | { ok: false; error: string; locked?: boolean };
    exposure1hop:
      | {
          ok: true;
          window: { lookbackDays: number };
          inbound: ReturnType<typeof computeTopInboundCounterparties>;
          counterparties: Array<{
            address: string;
            inboundAmount: string;
            inboundAmountBaseUnits: string;
            inboundTxCount: number;
            lastSeenIso: string;
            sampleTxHash?: string;
            flags: { sanctioned: boolean; usdtBlacklisted: boolean };
          }>;
          summary: {
            anyCounterpartySanctioned: boolean;
            anyCounterpartyBlacklisted: boolean;
            flaggedInboundShare: number; // 0..1 (observed)
            topCounterpartyShare: number; // 0..1 (observed)
            flaggedCounterpartyCount: number;
          };
          notices: string[];
        }
      | { ok: false; error: string; locked?: boolean };
    tracing2hop:
      | {
          ok: true;
          window: { lookbackDays: number; topN: number; sampleK: number };
          anyFlagged: boolean;
          paths: Array<{
            viaCounterparty: string;
            sources: Array<{ address: string; flags: { sanctioned: boolean; usdtBlacklisted: boolean } }>;
          }>;
          notices: string[];
        }
      | { ok: false; error: string; locked?: boolean };
    heuristics:
      | ReturnType<typeof computeFlowHeuristics>
      | { ok: false; error: string; locked?: boolean };
  };
  consensus: {
    status: "blacklisted" | "not_blacklisted" | "inconclusive";
    match: boolean;
  };
  risk: ReturnType<typeof computeRiskScore>;
  timestamps: { checkedAtIso: string };
  notices: string[];
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const ipState = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(ip: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = ipState.get(ip);
  if (!existing || existing.resetAt <= now) {
    ipState.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  ipState.set(ip, existing);
  if (existing.count <= RATE_LIMIT_MAX) return { limited: false, retryAfterSeconds: 0 };
  return { limited: true, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
}

function computeConsensus(tronscan: CheckResult, onchain: CheckResult) {
  if (tronscan.ok && onchain.ok) {
    const match = tronscan.blacklisted === onchain.blacklisted;
    if (!match) return { status: "inconclusive" as const, match };
    return { status: tronscan.blacklisted ? ("blacklisted" as const) : ("not_blacklisted" as const), match };
  }
  return { status: "inconclusive" as const, match: false };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]!, i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = isRateLimited(ip);
  if (limited.limited) {
    return NextResponse.json(
      {
        address: "",
        isValid: false,
        access: { authenticated: false },
        checks: {
          tronscan: { ok: false, blacklisted: false, error: "Rate limited." },
          onchain: { ok: false, blacklisted: false, error: "Rate limited." },
          sanctions: { ok: false, matched: false, error: "Rate limited." },
          entity: { ok: false, error: "Rate limited." },
          volume: { ok: false, error: "Rate limited." },
          exposure1hop: { ok: false, error: "Rate limited." },
          tracing2hop: { ok: false, error: "Rate limited." },
          heuristics: { ok: false, error: "Rate limited." },
        },
        consensus: { status: "inconclusive", match: false },
        risk: { score: 0, tier: "low", confidence: 0, breakdown: [] },
        timestamps: { checkedAtIso: new Date().toISOString() },
        notices: ["Too many requests. Please wait and try again."],
      } satisfies AnalyzeResponse,
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(limited.retryAfterSeconds),
        },
      },
    );
  }

  if (!request.headers.get("user-agent")) {
    return NextResponse.json(
      { error: "Missing user-agent." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = CheckRequestSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid address.";
    return NextResponse.json(
      {
        address: "",
        isValid: false,
        access: { authenticated: false },
        checks: {
          tronscan: { ok: false, blacklisted: false, error: message },
          onchain: { ok: false, blacklisted: false, error: message },
          sanctions: { ok: false, matched: false, error: message },
          entity: { ok: false, error: message },
          volume: { ok: false, error: message },
          exposure1hop: { ok: false, error: message },
          tracing2hop: { ok: false, error: message },
          heuristics: { ok: false, error: message },
        },
        consensus: { status: "inconclusive", match: false },
        risk: { score: 0, tier: "low", confidence: 0, breakdown: [] },
        timestamps: { checkedAtIso: new Date().toISOString() },
        notices: ["Provide a valid public TRON address (starts with “T”)."],
      } satisfies AnalyzeResponse,
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const address = parsed.data.address;

  let authenticated = false;
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
    try {
      const { userId } = await auth();
      authenticated = Boolean(userId);
    } catch {
      authenticated = false;
    }
  }

  const analysisCacheKey = sha256Key(["api_analyze", address, authenticated ? "auth" : "anon"]);
  const response = await getOrSetCache<AnalyzeResponse>(analysisCacheKey, 20_000, async () => {
    const checkedAtIso = new Date().toISOString();

    const [tronscanSettled, onchainSettled] = await Promise.allSettled([
      checkTronScanUsdtBlacklist(address),
      readUsdtBlacklistStatusOnChain(address, { timeoutMs: 8_000 }),
    ]);

    const tronscan: CheckResult =
      tronscanSettled.status === "fulfilled"
        ? tronscanSettled.value
        : { ok: false, blacklisted: false, error: "TronScan check failed." };

    const onchain: CheckResult =
      onchainSettled.status === "fulfilled"
        ? onchainSettled.value.ok
          ? {
              ok: true,
              blacklisted: onchainSettled.value.blacklisted,
              evidence: {
                contractAddress: onchainSettled.value.evidence.contractAddress,
                method: onchainSettled.value.evidence.method,
                raw: onchainSettled.value.evidence.raw,
                fullHost: onchainSettled.value.evidence.fullHost,
              },
            }
          : { ok: false, blacklisted: false, error: onchainSettled.value.error }
        : { ok: false, blacklisted: false, error: "On-chain check failed." };

    const consensus = computeConsensus(tronscan, onchain);
    const sanctions = checkOfacSanctions(address);

    // Fetch USDT balance
    const balanceRes = await fetchUsdtBalance(address);
    const balance: AnalyzeResponse["balance"] = balanceRes.ok
      ? { ok: true, usdt: balanceRes.balance, usdtBaseUnits: balanceRes.balanceBaseUnits }
      : { ok: false, error: balanceRes.error };

    const notices: string[] = [
      "Never share your seed phrase or private keys. This tool only needs a public address.",
      "We don’t store addresses or run analytics by default.",
    ];

    if (!authenticated) notices.push("Sign in to unlock additional AML checks (volume context, tracing, and more).");
    if (!tronscan.ok || !onchain.ok) notices.push("One or more blacklist verification methods failed. Results may be incomplete.");
    if (!sanctions.ok) notices.push("Sanctions screen failed to run.");

    let volume: AnalyzeResponse["checks"]["volume"] = { ok: false, error: "Sign in required.", locked: true };
    let volumeAvailable = false;

    const transfers = await fetchUsdtTrc20Transfers(address, {
      lookbackDays: 90,
      pageSize: 50,
      maxPages: authenticated ? 20 : 10,
      timeoutMs: 8_000,
    });

    const subjectTagRes = await fetchTronScanAccountTag(address);

    let entity: AnalyzeResponse["checks"]["entity"] = { ok: false, error: "Entity check failed." };
    if (transfers.ok) {
      const byTo = new Map<string, { amount: bigint; count: number }>();
      for (const t of transfers.transfers) {
        if (t.from !== address) continue;
        const existing = byTo.get(t.to) ?? { amount: BigInt(0), count: 0 };
        existing.amount += t.amountBaseUnits;
        existing.count += 1;
        byTo.set(t.to, existing);
      }
      const topOutbound = [...byTo.entries()]
        .map(([to, v]) => ({ to, ...v }))
        .sort((a, b) => (a.amount === b.amount ? b.count - a.count : b.amount > a.amount ? 1 : -1))
        .slice(0, 10)
        .map((x) => x.to);

      const destTagPairs = await mapLimit(topOutbound, 5, async (to) => {
        const res = await fetchTronScanAccountTag(to);
        return { to, res };
      });
      const destTags = new Map(destTagPairs.map((p) => [p.to, (p.res.ok ? p.res.tag : undefined)]));
      const classified = classifyEntityFromTagsAndTransfers({
        address,
        nowMs: transfers.window.toTsMs,
        lookbackDays: 90,
        subjectTag: subjectTagRes.ok ? subjectTagRes.tag : undefined,
        outboundTransfers: transfers.transfers,
        outboundDestTags: destTags,
        topOutboundN: 10,
      });

      entity = {
        ok: true,
        kind: classified.kind,
        label: classified.label,
        confidence: classified.confidence,
        reasons: classified.reasons,
        subjectTag: classified.subjectTag
          ? { ...classified.subjectTag }
          : undefined,
        outbound: classified.outbound
          ? {
              totalOutboundAmount: classified.outbound.totalOutboundAmount,
              exchangeTaggedShare: classified.outbound.exchangeTaggedShare,
              top: classified.outbound.top.map((o) => ({
                address: o.address,
                outboundAmount: o.outboundAmount,
                outboundTxCount: o.outboundTxCount,
                publicTag: o.publicTag,
                isExchangeTagged: o.isExchangeTagged,
              })),
            }
          : undefined,
      };
    } else if (subjectTagRes.ok) {
      const classified = classifyEntityFromTagsAndTransfers({
        address,
        nowMs: Date.now(),
        lookbackDays: 90,
        subjectTag: subjectTagRes.tag,
        outboundTransfers: [],
        outboundDestTags: new Map(),
        topOutboundN: 10,
      });
      entity = {
        ok: true,
        kind: classified.kind,
        label: classified.label,
        confidence: classified.confidence,
        reasons: classified.reasons,
        subjectTag: classified.subjectTag
          ? { ...classified.subjectTag }
          : undefined,
      };
    } else {
      entity = { ok: false, error: transfers.error };
    }

    if (authenticated) {
      if (transfers.ok) {
        const stats = computeUsdtVolumeStats(transfers.transfers, address, transfers.window.toTsMs);
        volume = { ok: true, stats, notices: transfers.notices };
        volumeAvailable = true;
      } else {
        volume = { ok: false, error: transfers.error };
        notices.push("USDT transfer history could not be fetched.");
      }
    }

    let exposure1hop: AnalyzeResponse["checks"]["exposure1hop"] = { ok: false, error: "Unavailable." };
    if (transfers.ok) {
      const inbound = computeTopInboundCounterparties(transfers.transfers, address, { lookbackDays: 90, topN: 10, nowMs: transfers.window.toTsMs });
      const toCheck = inbound.top.map((c) => c.address);

      const checked = await mapLimit(toCheck, 5, async (counterparty) => {
        const sanctionsRes = checkOfacSanctions(counterparty);
        const blackRes = await checkTronScanUsdtBlacklist(counterparty);
        return {
          address: counterparty,
          sanctioned: sanctionsRes.ok && sanctionsRes.matched,
          usdtBlacklisted: blackRes.ok && blackRes.blacklisted,
        };
      });

      const byAddress = new Map(checked.map((c) => [c.address, c]));
      const counterparties = inbound.top.map((c) => {
        const flags = byAddress.get(c.address) ?? { sanctioned: false, usdtBlacklisted: false };
        return {
          ...c,
          flags: { sanctioned: flags.sanctioned, usdtBlacklisted: flags.usdtBlacklisted },
        };
      });

      const totalInbound = BigInt(inbound.totalInboundBaseUnits || "0");
      const flaggedInbound = counterparties.reduce(
        (acc, c) => (c.flags.sanctioned || c.flags.usdtBlacklisted ? acc + BigInt(c.inboundAmountBaseUnits) : acc),
        BigInt(0),
      );
      const topCounterpartyShare =
        counterparties.length > 0 && totalInbound > BigInt(0)
          ? Number(BigInt(counterparties[0]!.inboundAmountBaseUnits) * BigInt(10_000) / totalInbound) / 10_000
          : 0;
      const flaggedInboundShare =
        totalInbound > BigInt(0) ? Number(flaggedInbound * BigInt(10_000) / totalInbound) / 10_000 : 0;

      const anyCounterpartySanctioned = counterparties.some((c) => c.flags.sanctioned);
      const anyCounterpartyBlacklisted = counterparties.some((c) => c.flags.usdtBlacklisted);
      const flaggedCounterpartyCount = counterparties.filter((c) => c.flags.sanctioned || c.flags.usdtBlacklisted).length;

      const exposureNotices = [...transfers.notices];
      if (totalInbound === BigInt(0)) exposureNotices.push("No inbound USDT transfers found in the analyzed window.");
      if (transfers.notices.length) exposureNotices.push("Exposure is computed from a best-effort sample of transfers.");

      exposure1hop = {
        ok: true,
        window: { lookbackDays: 90 },
        inbound,
        counterparties,
        summary: {
          anyCounterpartySanctioned,
          anyCounterpartyBlacklisted,
          flaggedInboundShare,
          topCounterpartyShare,
          flaggedCounterpartyCount,
        },
        notices: exposureNotices,
      };
    } else {
      exposure1hop = { ok: false, error: transfers.error };
    }

    let tracing2hop: AnalyzeResponse["checks"]["tracing2hop"] = { ok: false, error: "Sign in required.", locked: true };
    if (authenticated && transfers.ok) {
      const inbound = computeTopInboundCounterparties(transfers.transfers, address, { lookbackDays: 90, topN: 10, nowMs: transfers.window.toTsMs });
      const via = inbound.top.map((c) => c.address);
      const topN = 10;
      const sampleK = 5;

      const paths = await mapLimit(via.slice(0, topN), 2, async (viaCounterparty) => {
        const viaTransfers = await fetchUsdtTrc20Transfers(viaCounterparty, { lookbackDays: 90, pageSize: 50, maxPages: 5, timeoutMs: 8_000 });
        if (!viaTransfers.ok) return { viaCounterparty, sources: [] as Array<{ address: string; flags: { sanctioned: boolean; usdtBlacklisted: boolean } }> };
        const sources = computeTopInboundCounterparties(viaTransfers.transfers, viaCounterparty, { lookbackDays: 90, topN: sampleK, nowMs: viaTransfers.window.toTsMs }).top;

        const checkedSources = await mapLimit(sources.map((s) => s.address), 5, async (sourceAddr) => {
          const s1 = checkOfacSanctions(sourceAddr);
          const b1 = await checkTronScanUsdtBlacklist(sourceAddr);
          return { address: sourceAddr, flags: { sanctioned: s1.ok && s1.matched, usdtBlacklisted: b1.ok && b1.blacklisted } };
        });

        return { viaCounterparty, sources: checkedSources.filter((s) => s.flags.sanctioned || s.flags.usdtBlacklisted) };
      });

      const anyFlagged = paths.some((p) => p.sources.some((s) => s.flags.sanctioned || s.flags.usdtBlacklisted));
      tracing2hop = {
        ok: true,
        window: { lookbackDays: 90, topN, sampleK },
        anyFlagged,
        paths: paths.slice(0, topN),
        notices: ["2-hop tracing is sampled and best-effort; it may miss relevant exposure."],
      };
    }

    let heuristics: AnalyzeResponse["checks"]["heuristics"] = { ok: false, error: "Sign in required.", locked: true };
    if (authenticated && transfers.ok) {
      heuristics = computeFlowHeuristics(transfers.transfers, address, { lookbackDays: 90, nowMs: transfers.window.toTsMs });
    }

    const anyMethodBlacklisted = (tronscan.ok && tronscan.blacklisted) || (onchain.ok && onchain.blacklisted);

    const lockedChecks: Array<"volume" | "exposure1hop" | "tracing2hop" | "heuristics"> = [];
    if (!authenticated) {
      lockedChecks.push("volume", "tracing2hop", "heuristics");
    }

    const failedChecks: Array<"tronscan" | "onchain" | "sanctions" | "transfers"> = [];
    if (!tronscan.ok) failedChecks.push("tronscan");
    if (!onchain.ok) failedChecks.push("onchain");
    if (!sanctions.ok) failedChecks.push("sanctions");
    if (!transfers.ok) failedChecks.push("transfers");

    const partialSignals: Array<"pagination_limited" | "window_limited"> = [];
    if (transfers.ok && transfers.notices.some((n) => n.toLowerCase().includes("pagination"))) partialSignals.push("pagination_limited");

    const confidencePercent = computeConfidencePercent({ lockedChecks, failedChecks, partialSignals });

    const risk = computeRiskScore({
      blacklist: { status: consensus.status, anyMethodBlacklisted },
      sanctionsMatched: sanctions.ok && sanctions.matched,
      confidencePercent,
      volume: volume.ok ? volume.stats : undefined,
      volumeAvailable,
      exposure1hop:
        exposure1hop.ok
          ? {
              anyCounterpartySanctioned: exposure1hop.summary.anyCounterpartySanctioned,
              anyCounterpartyBlacklisted: exposure1hop.summary.anyCounterpartyBlacklisted,
              flaggedVolumeShare: exposure1hop.summary.flaggedInboundShare,
              topCounterpartyShare: exposure1hop.summary.topCounterpartyShare,
              observedInboundTxCount: exposure1hop.inbound.totalInboundTxCount,
              observedInboundTotalBaseUnits: exposure1hop.inbound.totalInboundBaseUnits,
            }
          : undefined,
      tracing2hop: tracing2hop.ok ? { anyFlagged: tracing2hop.anyFlagged } : undefined,
      heuristics: heuristics.ok ? { findings: heuristics.findings } : undefined,
    });

    return {
      address,
      isValid: true,
      access: { authenticated },
      balance,
      checks: { tronscan, onchain, sanctions, entity, volume, exposure1hop, tracing2hop, heuristics },
      consensus,
      risk,
      timestamps: { checkedAtIso },
      notices,
    };
  });

  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
}
