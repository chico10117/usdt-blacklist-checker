import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CheckRequestSchema } from "@/lib/validators";
import { readUsdtBlacklistStatusOnChain } from "@/lib/tron";
import { checkTronScanUsdtBlacklist } from "@/lib/tronscan";
import { checkOfacSanctions } from "@/lib/sanctions";
import { computeRiskScore, computeUsdtVolumeStats } from "@/lib/aml";
import { fetchUsdtTrc20Transfers } from "@/lib/tronscan";

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
  checks: {
    tronscan: CheckResult;
    onchain: CheckResult;
    sanctions: ReturnType<typeof checkOfacSanctions>;
    volume: { ok: true; stats: ReturnType<typeof computeUsdtVolumeStats>; notices: string[] } | { ok: false; error: string; locked?: boolean };
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
          volume: { ok: false, error: "Rate limited." },
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
          volume: { ok: false, error: message },
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
  const checkedAtIso = new Date().toISOString();

  let authenticated = false;
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
    try {
      const { userId } = await auth();
      authenticated = Boolean(userId);
    } catch {
      authenticated = false;
    }
  }

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

  const notices: string[] = [
    "Never share your seed phrase or private keys. This tool only needs a public address.",
    "We don’t store addresses or run analytics by default.",
  ];

  if (!authenticated) notices.push("Sign in to unlock additional AML checks (volume context, tracing, and more).");
  if (!tronscan.ok || !onchain.ok) notices.push("One or more blacklist verification methods failed. Results may be incomplete.");
  if (!sanctions.ok) notices.push("Sanctions screen failed to run.");

  let volume: AnalyzeResponse["checks"]["volume"] = { ok: false, error: "Sign in required.", locked: true };
  let volumeAvailable = false;
  let volumeNotices: string[] | undefined;

  if (authenticated) {
    const transfers = await fetchUsdtTrc20Transfers(address, { lookbackDays: 90, pageSize: 50, maxPages: 20, timeoutMs: 8_000 });
    if (transfers.ok) {
      const stats = computeUsdtVolumeStats(transfers.transfers, address, transfers.window.toTsMs);
      volume = { ok: true, stats, notices: transfers.notices };
      volumeAvailable = true;
      volumeNotices = transfers.notices;
    } else {
      volume = { ok: false, error: transfers.error };
      notices.push("USDT transfer history could not be fetched.");
    }
  }

  const anyMethodBlacklisted = (tronscan.ok && tronscan.blacklisted) || (onchain.ok && onchain.blacklisted);

  const risk = computeRiskScore({
    blacklist: { status: consensus.status, anyMethodBlacklisted },
    sanctionsMatched: sanctions.ok && sanctions.matched,
    volume: volume.ok ? volume.stats : undefined,
    volumeAvailable,
    volumeNotices,
  });

  const response: AnalyzeResponse = {
    address,
    isValid: true,
    access: { authenticated },
    checks: { tronscan, onchain, sanctions, volume },
    consensus,
    risk,
    timestamps: { checkedAtIso },
    notices,
  };

  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
}
