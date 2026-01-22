import type { NormalizedUsdtTransfer } from "@/lib/tronscan";
import { normalizeTronAddress } from "@/lib/validators";

const USDT_DECIMALS = BigInt(6);
const USDT_BASE = BigInt(10) ** USDT_DECIMALS;

export function formatUsdtFromBaseUnits(amountBaseUnits: bigint): string {
  const negative = amountBaseUnits < BigInt(0);
  const n = negative ? -amountBaseUnits : amountBaseUnits;
  const whole = n / USDT_BASE;
  const frac = n % USDT_BASE;
  const fracStr = frac.toString().padStart(Number(USDT_DECIMALS), "0").replace(/0+$/, "");
  const out = fracStr.length ? `${whole.toString()}.${fracStr}` : whole.toString();
  return negative ? `-${out}` : out;
}

function inWindow(tsMs: number, nowMs: number, days: number): boolean {
  return tsMs >= nowMs - days * 24 * 60 * 60 * 1000;
}

export type VolumeWindowStats = {
  windowDays: 7 | 30 | 90;
  inbound: { amountBaseUnits: string; amount: string; txCount: number };
  outbound: { amountBaseUnits: string; amount: string; txCount: number };
};

export type VolumeStats = {
  windows: Record<"d7" | "d30" | "d90", VolumeWindowStats>;
  largestInbound?: { amount: string; amountBaseUnits: string; txHash: string; from: string; timestampIso: string };
  largestOutbound?: { amount: string; amountBaseUnits: string; txHash: string; to: string; timestampIso: string };
};

export function computeUsdtVolumeStats(transfers: NormalizedUsdtTransfer[], address: string, nowMs = Date.now()): VolumeStats {
  const subject = normalizeTronAddress(address);
  const cutoff90 = nowMs - 90 * 24 * 60 * 60 * 1000;

  const windows = {
    d7: { inAmt: BigInt(0), outAmt: BigInt(0), inCount: 0, outCount: 0, days: 7 as const },
    d30: { inAmt: BigInt(0), outAmt: BigInt(0), inCount: 0, outCount: 0, days: 30 as const },
    d90: { inAmt: BigInt(0), outAmt: BigInt(0), inCount: 0, outCount: 0, days: 90 as const },
  };

  let largestInbound: { amount: bigint; txHash: string; from: string; timestampMs: number } | null = null;
  let largestOutbound: { amount: bigint; txHash: string; to: string; timestampMs: number } | null = null;

  for (const t of transfers) {
    if (t.timestampMs < cutoff90) continue;
    const isIn = t.to === subject;
    const isOut = t.from === subject;
    if (!isIn && !isOut) continue;

    if (isIn && (!largestInbound || t.amountBaseUnits > largestInbound.amount)) {
      largestInbound = { amount: t.amountBaseUnits, txHash: t.txHash, from: t.from, timestampMs: t.timestampMs };
    }
    if (isOut && (!largestOutbound || t.amountBaseUnits > largestOutbound.amount)) {
      largestOutbound = { amount: t.amountBaseUnits, txHash: t.txHash, to: t.to, timestampMs: t.timestampMs };
    }

    for (const w of Object.values(windows)) {
      if (!inWindow(t.timestampMs, nowMs, w.days)) continue;
      if (isIn) {
        w.inAmt += t.amountBaseUnits;
        w.inCount += 1;
      }
      if (isOut) {
        w.outAmt += t.amountBaseUnits;
        w.outCount += 1;
      }
    }
  }

  const out: VolumeStats = {
    windows: {
      d7: {
        windowDays: 7,
        inbound: {
          amountBaseUnits: windows.d7.inAmt.toString(),
          amount: formatUsdtFromBaseUnits(windows.d7.inAmt),
          txCount: windows.d7.inCount,
        },
        outbound: {
          amountBaseUnits: windows.d7.outAmt.toString(),
          amount: formatUsdtFromBaseUnits(windows.d7.outAmt),
          txCount: windows.d7.outCount,
        },
      },
      d30: {
        windowDays: 30,
        inbound: {
          amountBaseUnits: windows.d30.inAmt.toString(),
          amount: formatUsdtFromBaseUnits(windows.d30.inAmt),
          txCount: windows.d30.inCount,
        },
        outbound: {
          amountBaseUnits: windows.d30.outAmt.toString(),
          amount: formatUsdtFromBaseUnits(windows.d30.outAmt),
          txCount: windows.d30.outCount,
        },
      },
      d90: {
        windowDays: 90,
        inbound: {
          amountBaseUnits: windows.d90.inAmt.toString(),
          amount: formatUsdtFromBaseUnits(windows.d90.inAmt),
          txCount: windows.d90.inCount,
        },
        outbound: {
          amountBaseUnits: windows.d90.outAmt.toString(),
          amount: formatUsdtFromBaseUnits(windows.d90.outAmt),
          txCount: windows.d90.outCount,
        },
      },
    },
  };

  if (largestInbound) {
    out.largestInbound = {
      amountBaseUnits: largestInbound.amount.toString(),
      amount: formatUsdtFromBaseUnits(largestInbound.amount),
      txHash: largestInbound.txHash,
      from: largestInbound.from,
      timestampIso: new Date(largestInbound.timestampMs).toISOString(),
    };
  }
  if (largestOutbound) {
    out.largestOutbound = {
      amountBaseUnits: largestOutbound.amount.toString(),
      amount: formatUsdtFromBaseUnits(largestOutbound.amount),
      txHash: largestOutbound.txHash,
      to: largestOutbound.to,
      timestampIso: new Date(largestOutbound.timestampMs).toISOString(),
    };
  }

  return out;
}

export type RiskTier = "low" | "guarded" | "elevated" | "high" | "severe";

export type ScoreItem = { key: string; label: string; points: number; evidence?: string[] };

export type RiskScore = {
  score: number; // 0..100
  tier: RiskTier;
  confidence: number; // 0..1
  breakdown: ScoreItem[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function tierFor(score: number): RiskTier {
  if (score >= 90) return "severe";
  if (score >= 70) return "high";
  if (score >= 40) return "elevated";
  if (score >= 20) return "guarded";
  return "low";
}

export function computeRiskScore(input: {
  blacklist: { status: "blacklisted" | "not_blacklisted" | "inconclusive"; anyMethodBlacklisted: boolean };
  sanctionsMatched: boolean;
  volume?: VolumeStats;
  volumeAvailable: boolean;
  volumeNotices?: string[];
}): RiskScore {
  const breakdown: ScoreItem[] = [];

  const confidence = clamp(
    input.volumeAvailable ? (input.volumeNotices?.length ? 0.85 : 0.95) : 0.6,
    0,
    1,
  );

  if (input.sanctionsMatched) {
    return {
      score: 100,
      tier: "severe",
      confidence,
      breakdown: [{ key: "sanctions", label: "OFAC sanctions match", points: 100 }],
    };
  }

  if (input.blacklist.status === "blacklisted") {
    return {
      score: 100,
      tier: "severe",
      confidence,
      breakdown: [{ key: "blacklist", label: "USDT blacklist match (TRON)", points: 100 }],
    };
  }

  let score = 5;
  breakdown.push({ key: "base", label: "Baseline risk", points: 5 });

  if (input.blacklist.anyMethodBlacklisted) {
    score = 95;
    breakdown.push({
      key: "blacklist_partial",
      label: "USDT blacklist signal (inconclusive consensus)",
      points: 90,
    });
    return { score: clamp(score, 0, 100), tier: tierFor(score), confidence, breakdown };
  }

  if (input.volumeAvailable && input.volume) {
    const inbound90 = BigInt(input.volume.windows.d90.inbound.amountBaseUnits);
    const inboundScore =
      inbound90 >= BigInt("10000000000")
        ? 8
        : inbound90 >= BigInt("1000000000")
          ? 5
          : inbound90 >= BigInt("100000000")
            ? 3
            : 0; // 10k/1k/100 USDT
    if (inboundScore) breakdown.push({ key: "volume_in", label: "High USDT inbound volume (90d)", points: inboundScore });

    const txCount90 = input.volume.windows.d90.inbound.txCount + input.volume.windows.d90.outbound.txCount;
    const txScore = txCount90 >= 2000 ? 5 : txCount90 >= 500 ? 3 : txCount90 >= 100 ? 1 : 0;
    if (txScore) breakdown.push({ key: "volume_tx", label: "High USDT activity (90d)", points: txScore });

    score += inboundScore + txScore;
  }

  score = clamp(Math.round(score * confidence), 0, 100);
  return { score, tier: tierFor(score), confidence, breakdown };
}
