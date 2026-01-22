import type { NormalizedUsdtTransfer } from "@/lib/tronscan";
import { normalizeTronAddress } from "@/lib/validators";

export type FlowHeuristicFinding =
  | {
      key: "fast_in_fast_out";
      label: string;
      severity: "info" | "warning" | "danger";
      evidence: { inboundTxHash: string; outboundTxHashes: string[]; windowMinutes: number };
    }
  | {
      key: "structuring_like";
      label: string;
      severity: "info" | "warning" | "danger";
      evidence: { windowHours: number; smallDepositCount: number; totalSmallInboundUsdt: string };
    }
  | {
      key: "peel_like";
      label: string;
      severity: "info" | "warning" | "danger";
      evidence: { inboundTxHash: string; outboundCount: number; windowHours: number };
    };

export type FlowHeuristicsResult = {
  ok: true;
  findings: FlowHeuristicFinding[];
  parameters: {
    lookbackDays: number;
    fastInFastOutMinutes: number;
    fastInFastOutMinInboundUsdt: number;
    fastInFastOutOutflowShare: number;
    structuringWindowHours: number;
    structuringSmallInboundMaxUsdt: number;
    structuringMinCount: number;
    structuringMinTotalUsdt: number;
    peelWindowHours: number;
    peelMinLargeInboundUsdt: number;
    peelMinOutboundCount: number;
  };
};

const USDT_DECIMALS = BigInt(6);
const USDT_BASE = BigInt(10) ** USDT_DECIMALS;

function formatUsdtFromBaseUnits(amountBaseUnits: bigint): string {
  const negative = amountBaseUnits < BigInt(0);
  const n = negative ? -amountBaseUnits : amountBaseUnits;
  const whole = n / USDT_BASE;
  const frac = n % USDT_BASE;
  const fracStr = frac.toString().padStart(Number(USDT_DECIMALS), "0").replace(/0+$/, "");
  const out = fracStr.length ? `${whole.toString()}.${fracStr}` : whole.toString();
  return negative ? `-${out}` : out;
}

function ms(minutes: number) {
  return minutes * 60 * 1000;
}

function hoursMs(hours: number) {
  return hours * 60 * 60 * 1000;
}

export function computeFlowHeuristics(
  transfers: NormalizedUsdtTransfer[],
  subjectAddress: string,
  options?: Partial<FlowHeuristicsResult["parameters"]> & { nowMs?: number },
): FlowHeuristicsResult {
  const subject = normalizeTronAddress(subjectAddress);
  const nowMs = options?.nowMs ?? Date.now();

  const params: FlowHeuristicsResult["parameters"] = {
    lookbackDays: options?.lookbackDays ?? 90,
    fastInFastOutMinutes: options?.fastInFastOutMinutes ?? 120,
    fastInFastOutMinInboundUsdt: options?.fastInFastOutMinInboundUsdt ?? 1_000,
    fastInFastOutOutflowShare: options?.fastInFastOutOutflowShare ?? 0.8,
    structuringWindowHours: options?.structuringWindowHours ?? 24,
    structuringSmallInboundMaxUsdt: options?.structuringSmallInboundMaxUsdt ?? 100,
    structuringMinCount: options?.structuringMinCount ?? 20,
    structuringMinTotalUsdt: options?.structuringMinTotalUsdt ?? 1_000,
    peelWindowHours: options?.peelWindowHours ?? 6,
    peelMinLargeInboundUsdt: options?.peelMinLargeInboundUsdt ?? 10_000,
    peelMinOutboundCount: options?.peelMinOutboundCount ?? 10,
  };

  const cutoff = nowMs - params.lookbackDays * 24 * 60 * 60 * 1000;
  const inbound = transfers
    .filter((t) => t.timestampMs >= cutoff && t.to === subject)
    .sort((a, b) => a.timestampMs - b.timestampMs);
  const outbound = transfers
    .filter((t) => t.timestampMs >= cutoff && t.from === subject)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const findings: FlowHeuristicFinding[] = [];

  // 1) Fast-in-fast-out: large inbound followed by near-immediate outflow.
  const minInboundBase = BigInt(Math.floor(params.fastInFastOutMinInboundUsdt * 1_000_000));
  const shareBasis = BigInt(1000);
  const requiredShare = BigInt(Math.floor(params.fastInFastOutOutflowShare * 1000));
  for (const inTx of inbound) {
    if (inTx.amountBaseUnits < minInboundBase) continue;
    const windowEnd = inTx.timestampMs + ms(params.fastInFastOutMinutes);
    let outflow = BigInt(0);
    const outHashes: string[] = [];
    for (const outTx of outbound) {
      if (outTx.timestampMs <= inTx.timestampMs) continue;
      if (outTx.timestampMs > windowEnd) break;
      outflow += outTx.amountBaseUnits;
      outHashes.push(outTx.txHash);
    }
    if (outHashes.length === 0) continue;
    if (outflow * shareBasis >= inTx.amountBaseUnits * requiredShare) {
      findings.push({
        key: "fast_in_fast_out",
        label: "Fast-in / fast-out pattern (best-effort)",
        severity: outflow * shareBasis >= inTx.amountBaseUnits * BigInt(950) ? "danger" : "warning",
        evidence: { inboundTxHash: inTx.txHash, outboundTxHashes: outHashes.slice(0, 10), windowMinutes: params.fastInFastOutMinutes },
      });
      break;
    }
  }

  // 2) Structuring-like: many small inbound deposits inside a 24h window.
  const smallMaxBase = BigInt(Math.floor(params.structuringSmallInboundMaxUsdt * 1_000_000));
  const windowMs = hoursMs(params.structuringWindowHours);
  let left = 0;
  let runningCount = 0;
  let runningTotal = BigInt(0);
  const smallInbound = inbound.filter((t) => t.amountBaseUnits > BigInt(0) && t.amountBaseUnits <= smallMaxBase);

  for (let right = 0; right < smallInbound.length; right += 1) {
    const t = smallInbound[right]!;
    runningCount += 1;
    runningTotal += t.amountBaseUnits;

    while (t.timestampMs - smallInbound[left]!.timestampMs > windowMs) {
      runningCount -= 1;
      runningTotal -= smallInbound[left]!.amountBaseUnits;
      left += 1;
    }

    if (runningCount >= params.structuringMinCount && runningTotal >= BigInt(Math.floor(params.structuringMinTotalUsdt * 1_000_000))) {
      findings.push({
        key: "structuring_like",
        label: "Many small inbound deposits (best-effort)",
        severity: runningCount >= params.structuringMinCount * 2 ? "danger" : "warning",
        evidence: {
          windowHours: params.structuringWindowHours,
          smallDepositCount: runningCount,
          totalSmallInboundUsdt: formatUsdtFromBaseUnits(runningTotal),
        },
      });
      break;
    }
  }

  // 3) Peel-like: large inbound followed by many outbound transfers in short window.
  const peelMinInboundBase = BigInt(Math.floor(params.peelMinLargeInboundUsdt * 1_000_000));
  for (const inTx of inbound) {
    if (inTx.amountBaseUnits < peelMinInboundBase) continue;
    const windowEnd = inTx.timestampMs + hoursMs(params.peelWindowHours);
    const outs = outbound.filter((o) => o.timestampMs > inTx.timestampMs && o.timestampMs <= windowEnd);
    if (outs.length >= params.peelMinOutboundCount) {
      findings.push({
        key: "peel_like",
        label: "Peel-chain-like outflow burst (best-effort)",
        severity: outs.length >= params.peelMinOutboundCount * 2 ? "danger" : "warning",
        evidence: { inboundTxHash: inTx.txHash, outboundCount: outs.length, windowHours: params.peelWindowHours },
      });
      break;
    }
  }

  return { ok: true, findings, parameters: params };
}
