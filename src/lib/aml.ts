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
  confidence: number; // 0..100 (how complete/credible this score is)
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

export type ConfidenceInput = {
  lockedChecks: Array<"volume" | "exposure1hop" | "tracing2hop" | "heuristics">;
  failedChecks: Array<"tronscan" | "onchain" | "sanctions" | "transfers">;
  partialSignals: Array<"pagination_limited" | "window_limited">;
};

export function computeConfidencePercent(input: ConfidenceInput): number {
  let confidence = 100;

  // Upstream failures: reduce confidence more than gating, since this is supposed to represent "quality" too.
  for (const key of input.failedChecks) {
    confidence -= key === "transfers" ? 25 : 15;
  }

  // Gating/locked: user is explicitly not seeing a full report.
  confidence -= input.lockedChecks.length * 10;

  // Partial signals from best-effort pagination/window limits.
  confidence -= input.partialSignals.length * 8;

  return clamp(confidence, 0, 100);
}

export function computeRiskScore(input: {
  blacklist: { status: "blacklisted" | "not_blacklisted" | "inconclusive"; anyMethodBlacklisted: boolean };
  sanctionsMatched: boolean;
  confidencePercent: number;
  volume?: VolumeStats;
  volumeAvailable: boolean;
  exposure1hop?: {
    anyCounterpartySanctioned: boolean;
    anyCounterpartyBlacklisted: boolean;
    flaggedVolumeShare?: number; // 0..1 of observed inbound volume
    topCounterpartyShare?: number; // 0..1 of observed inbound volume
    observedInboundTxCount?: number;
    observedInboundTotalBaseUnits?: string;
  };
  tracing2hop?: { anyFlagged: boolean };
  heuristics?: { findings: Array<{ key: string }> };
}): RiskScore {
  const breakdown: ScoreItem[] = [];
  const confidence = clamp(Math.round(input.confidencePercent), 0, 100);

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

  if (input.exposure1hop) {
    const exposure = input.exposure1hop;
    if (exposure.anyCounterpartySanctioned) {
      const points = exposure.flaggedVolumeShare !== undefined && exposure.flaggedVolumeShare >= 0.1 ? 30 : 20;
      breakdown.push({ key: "exposure_sanctions_1hop", label: "Direct exposure to OFAC-sanctioned address(es) (1-hop)", points });
      score += points;
    }
    if (exposure.anyCounterpartyBlacklisted) {
      breakdown.push({ key: "exposure_blacklist_1hop", label: "Direct exposure to USDT-blacklisted address(es) (1-hop)", points: 25 });
      score += 25;
    }
    const inboundTxCount = exposure.observedInboundTxCount ?? 0;
    const inboundTotal = exposure.observedInboundTotalBaseUnits ? BigInt(exposure.observedInboundTotalBaseUnits) : BigInt(0);
    const enoughSignal = inboundTxCount >= 20 || inboundTotal >= BigInt("1000000000"); // 1000 USDT
    if (enoughSignal && exposure.topCounterpartyShare !== undefined && exposure.topCounterpartyShare >= 0.8) {
      breakdown.push({ key: "in_concentration", label: "Highly concentrated inbound flow (top counterparty)", points: 8 });
      score += 8;
    }
  }

  if (input.tracing2hop?.anyFlagged) {
    breakdown.push({ key: "exposure_2hop", label: "2-hop proximity to flagged sources (sampled)", points: 10 });
    score += 10;
  }

  if (input.heuristics?.findings?.length) {
    for (const f of input.heuristics.findings) {
      if (f.key === "fast_in_fast_out") {
        breakdown.push({ key: "heur_fast", label: "Fast-in / fast-out behavior", points: 15 });
        score += 15;
      } else if (f.key === "peel_like") {
        breakdown.push({ key: "heur_peel", label: "Peel-chain-like outflow burst", points: 10 });
        score += 10;
      } else if (f.key === "structuring_like") {
        breakdown.push({ key: "heur_structuring", label: "Structuring-like inbound deposits", points: 8 });
        score += 8;
      }
    }
  }

  score = clamp(Math.round(score), 0, 100);
  return { score, tier: tierFor(score), confidence, breakdown };
}
