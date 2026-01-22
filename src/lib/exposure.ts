import type { NormalizedUsdtTransfer } from "@/lib/tronscan";
import { normalizeTronAddress } from "@/lib/validators";

export type InboundCounterparty = {
  address: string;
  inboundAmountBaseUnits: string;
  inboundAmount: string;
  inboundTxCount: number;
  lastSeenIso: string;
  sampleTxHash?: string;
};

export type InboundCounterpartySet = {
  totalInboundBaseUnits: string;
  totalInboundAmount: string;
  totalInboundTxCount: number;
  top: InboundCounterparty[];
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

export function computeTopInboundCounterparties(
  transfers: NormalizedUsdtTransfer[],
  subjectAddress: string,
  options?: { lookbackDays?: number; topN?: number; nowMs?: number },
): InboundCounterpartySet {
  const subject = normalizeTronAddress(subjectAddress);
  const nowMs = options?.nowMs ?? Date.now();
  const lookbackDays = options?.lookbackDays ?? 90;
  const topN = options?.topN ?? 10;
  const cutoff = nowMs - lookbackDays * 24 * 60 * 60 * 1000;

  const byFrom = new Map<
    string,
    { amount: bigint; count: number; lastSeenMs: number; sampleTxHash?: string }
  >();

  let totalInbound = BigInt(0);
  let totalInboundTxCount = 0;

  for (const t of transfers) {
    if (t.timestampMs < cutoff) continue;
    if (t.to !== subject) continue;
    totalInbound += t.amountBaseUnits;
    totalInboundTxCount += 1;
    const existing = byFrom.get(t.from) ?? { amount: BigInt(0), count: 0, lastSeenMs: 0 };
    existing.amount += t.amountBaseUnits;
    existing.count += 1;
    if (t.timestampMs > existing.lastSeenMs) {
      existing.lastSeenMs = t.timestampMs;
      existing.sampleTxHash = t.txHash;
    }
    byFrom.set(t.from, existing);
  }

  const top = [...byFrom.entries()]
    .map(([address, v]) => ({ address, ...v }))
    .sort((a, b) => (a.amount === b.amount ? b.lastSeenMs - a.lastSeenMs : b.amount > a.amount ? 1 : -1))
    .slice(0, topN)
    .map(
      (v): InboundCounterparty => ({
        address: v.address,
        inboundAmountBaseUnits: v.amount.toString(),
        inboundAmount: formatUsdtFromBaseUnits(v.amount),
        inboundTxCount: v.count,
        lastSeenIso: new Date(v.lastSeenMs).toISOString(),
        sampleTxHash: v.sampleTxHash,
      }),
    );

  return {
    totalInboundBaseUnits: totalInbound.toString(),
    totalInboundAmount: formatUsdtFromBaseUnits(totalInbound),
    totalInboundTxCount,
    top,
  };
}
