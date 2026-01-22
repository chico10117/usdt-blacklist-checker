import type { NormalizedUsdtTransfer } from "@/lib/tronscan";
import type { TronScanAccountTag } from "@/lib/tronscan";
import { formatUsdtFromBaseUnits } from "@/lib/aml";
import { normalizeTronAddress } from "@/lib/validators";

export type EntityKind = "exchange" | "particular" | "unknown";

export type OutboundCounterparty = {
  address: string;
  outboundAmountBaseUnits: string;
  outboundAmount: string;
  outboundTxCount: number;
  publicTag?: string;
  isExchangeTagged: boolean;
};

export type EntityClassification = {
  ok: true;
  kind: EntityKind;
  label: string;
  confidence: number; // 0..1
  reasons: string[];
  outbound?: {
    totalOutboundBaseUnits: string;
    totalOutboundAmount: string;
    exchangeTaggedShare: number; // 0..1
    top: OutboundCounterparty[];
  };
  subjectTag?: { publicTag?: string; blueTag?: string; greyTag?: string; redTag?: string };
};

const EXCHANGE_KEYWORDS: Array<{ keyword: string; name: string }> = [
  { keyword: "binance", name: "Binance" },
  { keyword: "okx", name: "OKX" },
  { keyword: "huobi", name: "Huobi" },
  { keyword: "htx", name: "HTX" },
  { keyword: "bybit", name: "Bybit" },
  { keyword: "kucoin", name: "KuCoin" },
  { keyword: "gate", name: "Gate" },
  { keyword: "mexc", name: "MEXC" },
  { keyword: "bitget", name: "Bitget" },
  { keyword: "kraken", name: "Kraken" },
  { keyword: "coinbase", name: "Coinbase" },
  { keyword: "bitfinex", name: "Bitfinex" },
  { keyword: "crypto.com", name: "Crypto.com" },
  { keyword: "exchange", name: "Exchange" },
];

export function isExchangePublicTag(publicTag?: string): { isExchange: boolean; exchangeName?: string } {
  if (!publicTag) return { isExchange: false };
  const s = publicTag.toLowerCase();
  for (const { keyword, name } of EXCHANGE_KEYWORDS) {
    if (s.includes(keyword)) return { isExchange: true, exchangeName: name };
  }
  return { isExchange: false };
}

export function classifyEntityFromTagsAndTransfers(input: {
  address: string;
  nowMs: number;
  lookbackDays: number;
  subjectTag?: TronScanAccountTag;
  outboundTransfers?: NormalizedUsdtTransfer[];
  outboundDestTags?: Map<string, TronScanAccountTag | undefined>;
  topOutboundN: number;
}): EntityClassification {
  const subject = normalizeTronAddress(input.address);
  const reasons: string[] = [];

  const subjectTag = input.subjectTag
    ? {
        publicTag: input.subjectTag.publicTag,
        blueTag: input.subjectTag.blueTag,
        greyTag: input.subjectTag.greyTag,
        redTag: input.subjectTag.redTag,
      }
    : undefined;

  const tagged = isExchangePublicTag(subjectTag?.publicTag);
  if (tagged.isExchange) {
    reasons.push(`TronScan public tag indicates exchange: "${subjectTag?.publicTag ?? "exchange"}".`);
    return {
      ok: true,
      kind: "exchange",
      label: subjectTag?.publicTag ?? "Exchange wallet",
      confidence: 0.9,
      reasons,
      subjectTag,
    };
  }

  const lookbackMs = input.lookbackDays * 24 * 60 * 60 * 1000;
  const cutoff = input.nowMs - lookbackMs;
  const transfers = input.outboundTransfers ?? [];

  const byTo = new Map<string, { amount: bigint; count: number }>();
  let totalOutbound = BigInt(0);

  for (const t of transfers) {
    if (t.timestampMs < cutoff) continue;
    if (t.from !== subject) continue;
    totalOutbound += t.amountBaseUnits;
    const existing = byTo.get(t.to) ?? { amount: BigInt(0), count: 0 };
    existing.amount += t.amountBaseUnits;
    existing.count += 1;
    byTo.set(t.to, existing);
  }

  const top = [...byTo.entries()]
    .map(([address, v]) => ({ address, ...v }))
    .sort((a, b) => (a.amount === b.amount ? b.count - a.count : b.amount > a.amount ? 1 : -1))
    .slice(0, input.topOutboundN);

  const outboundDestTags = input.outboundDestTags ?? new Map<string, TronScanAccountTag | undefined>();
  const topWithTags: OutboundCounterparty[] = top.map((o) => {
    const tag = outboundDestTags.get(o.address);
    const isExchangeTagged = isExchangePublicTag(tag?.publicTag).isExchange;
    return {
      address: o.address,
      outboundAmountBaseUnits: o.amount.toString(),
      outboundAmount: formatUsdtFromBaseUnits(o.amount),
      outboundTxCount: o.count,
      publicTag: tag?.publicTag,
      isExchangeTagged,
    };
  });

  const exchangeOutbound = topWithTags.reduce(
    (acc, o) => (o.isExchangeTagged ? acc + BigInt(o.outboundAmountBaseUnits) : acc),
    BigInt(0),
  );
  const exchangeTaggedShare =
    totalOutbound > BigInt(0) ? Number(exchangeOutbound * BigInt(10_000) / totalOutbound) / 10_000 : 0;

  const totalOutboundUsdt = totalOutbound;
  const enoughOutbound = totalOutboundUsdt >= BigInt("100000000"); // 100 USDT
  const strongExchangeRouting = enoughOutbound && exchangeTaggedShare >= 0.9;

  if (strongExchangeRouting) {
    reasons.push(`≥ ${Math.round(exchangeTaggedShare * 100)}% of observed outbound USDT goes to exchange-tagged addresses.`);
    return {
      ok: true,
      kind: "exchange",
      label: "Likely exchange deposit wallet",
      confidence: exchangeTaggedShare >= 0.97 ? 0.85 : 0.75,
      reasons,
      subjectTag,
      outbound: {
        totalOutboundBaseUnits: totalOutbound.toString(),
        totalOutboundAmount: formatUsdtFromBaseUnits(totalOutbound),
        exchangeTaggedShare,
        top: topWithTags,
      },
    };
  }

  if (enoughOutbound) {
    reasons.push("Outbound destinations are not predominantly exchange-tagged.");
    return {
      ok: true,
      kind: "particular",
      label: "Likely particular (personal) wallet",
      confidence: 0.6,
      reasons,
      subjectTag,
      outbound: {
        totalOutboundBaseUnits: totalOutbound.toString(),
        totalOutboundAmount: formatUsdtFromBaseUnits(totalOutbound),
        exchangeTaggedShare,
        top: topWithTags,
      },
    };
  }

  reasons.push("Insufficient outbound activity to classify reliably.");
  return {
    ok: true,
    kind: "unknown",
    label: "Unlabeled wallet",
    confidence: 0.4,
    reasons,
    subjectTag,
    outbound: {
      totalOutboundBaseUnits: totalOutbound.toString(),
      totalOutboundAmount: formatUsdtFromBaseUnits(totalOutbound),
      exchangeTaggedShare,
      top: topWithTags,
    },
  };
}

