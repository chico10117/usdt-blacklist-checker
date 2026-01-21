import { NextResponse } from "next/server";
import { z } from "zod";
import { CheckRequestSchema } from "@/lib/validators";
import { readUsdtBlacklistStatusOnChain, USDT_TRC20_CONTRACT } from "@/lib/tron";

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

type ApiResponse = {
  address: string;
  isValid: boolean;
  checks: {
    tronscan: CheckResult;
    onchain: CheckResult;
  };
  consensus: {
    status: "blacklisted" | "not_blacklisted" | "inconclusive";
    match: boolean;
  };
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

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

const TronScanRowSchema = z.object({
  blackAddress: z.string().optional(),
  tokenName: z.string().optional(),
  time: z.union([z.number(), z.string()]).optional(),
  transHash: z.string().optional(),
  contractAddress: z.string().optional(),
});

const TronScanResponseSchema = z.object({
  total: z.number().optional(),
  data: z.array(TronScanRowSchema).optional(),
});

async function checkTronScan(address: string): Promise<CheckResult> {
  const timeoutMs = 8_000;
  const url = `https://apilist.tronscanapi.com/api/stableCoin/blackList?blackAddress=${encodeURIComponent(
    address,
  )}`;
  try {
    const raw = await fetchJsonWithTimeout(url, timeoutMs);
    const parsed = TronScanResponseSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, blacklisted: false, error: "Unexpected TronScan response." };

    const rows = parsed.data.data ?? [];
    const total = parsed.data.total ?? rows.length;

    const usdtRows = rows.filter((row) => {
      const token = (row.tokenName ?? "").toUpperCase();
      const contract = (row.contractAddress ?? "").trim();
      return token.includes("USDT") || contract === USDT_TRC20_CONTRACT;
    });

    const blacklisted = total > 0 && usdtRows.length > 0;
    const best =
      usdtRows
        .map((row) => ({
          ...row,
          timeNum: typeof row.time === "string" ? Number(row.time) : row.time,
        }))
        .sort((a, b) => (b.timeNum ?? 0) - (a.timeNum ?? 0))[0] ?? null;

    const timestampIso =
      best?.timeNum && Number.isFinite(best.timeNum)
        ? new Date(best.timeNum * 1000).toISOString()
        : undefined;

    return {
      ok: true,
      blacklisted,
      evidence: blacklisted
        ? {
            contractAddress: best?.contractAddress || USDT_TRC20_CONTRACT,
            txHash: best?.transHash,
            timestampIso,
          }
        : { contractAddress: USDT_TRC20_CONTRACT },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "TronScan timed out."
          : error.message
        : "Unknown TronScan error.";
    return { ok: false, blacklisted: false, error: message };
  }
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
        checks: {
          tronscan: { ok: false, blacklisted: false, error: "Rate limited." },
          onchain: { ok: false, blacklisted: false, error: "Rate limited." },
        },
        consensus: { status: "inconclusive", match: false },
        timestamps: { checkedAtIso: new Date().toISOString() },
        notices: ["Too many requests. Please wait and try again."],
      } satisfies ApiResponse,
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
        checks: {
          tronscan: { ok: false, blacklisted: false, error: message },
          onchain: { ok: false, blacklisted: false, error: message },
        },
        consensus: { status: "inconclusive", match: false },
        timestamps: { checkedAtIso: new Date().toISOString() },
        notices: ["Provide a valid public TRON address (starts with “T”)."],
      } satisfies ApiResponse,
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const address = parsed.data.address;
  const checkedAtIso = new Date().toISOString();

  const [tronscanSettled, onchainSettled] = await Promise.allSettled([
    checkTronScan(address),
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
  const notices: string[] = [
    "Never share your seed phrase or private keys. This tool only needs a public address.",
    "We don’t store addresses or run analytics by default.",
  ];

  if (!tronscan.ok || !onchain.ok) {
    notices.push("One or more verification methods failed. Results may be incomplete.");
  }

  const response: ApiResponse = {
    address,
    isValid: true,
    checks: { tronscan, onchain },
    consensus,
    timestamps: { checkedAtIso },
    notices,
  };

  const bothFailed = !tronscan.ok && !onchain.ok;
  return NextResponse.json(response, {
    status: bothFailed ? 502 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
