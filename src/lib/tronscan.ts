import { z } from "zod";
import { USDT_TRC20_CONTRACT } from "@/lib/tron";
import { getOrSetCache, sha256Key } from "@/lib/cache";

export type TronScanEvidence = {
  contractAddress: string;
  txHash?: string;
  timestampIso?: string;
};

export type TronScanBlacklistResult =
  | { ok: true; blacklisted: boolean; evidence?: TronScanEvidence }
  | { ok: false; blacklisted: false; error: string };

function withFetchTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

export async function fetchTronScanJson(url: string, timeoutMs = 8_000): Promise<unknown> {
  const cacheKey = sha256Key(["tronscan_json", url]);
  return await getOrSetCache(cacheKey, 30_000, async () => {
    const { controller, timeout } = withFetchTimeout(timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json", "user-agent": "usdt_blacklisted_web/1.0" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  });
}

const TronScanAccountTagResponseSchema = z
  .object({
    publicTag: z.string().optional(),
    blueTag: z.string().optional(),
    greyTag: z.string().optional(),
    redTag: z.string().optional(),
  })
  .passthrough();

export type TronScanAccountTag = z.infer<typeof TronScanAccountTagResponseSchema>;

export type TronScanAccountTagResult =
  | { ok: true; tag: TronScanAccountTag; evidenceUrl: string }
  | { ok: false; error: string };

export async function fetchTronScanAccountTag(address: string): Promise<TronScanAccountTagResult> {
  const cacheKey = sha256Key(["tronscan_account_tag", address]);
  return await getOrSetCache(cacheKey, 6 * 60 * 60 * 1000, async () => {
    const evidenceUrl = `https://apilist.tronscanapi.com/api/account/tag?address=${encodeURIComponent(address)}`;
    try {
      const raw = await fetchTronScanJson(evidenceUrl, 8_000);
      const parsed = TronScanAccountTagResponseSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: "Unexpected TronScan account tag response." };
      return { ok: true, tag: parsed.data, evidenceUrl };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? "TronScan timed out."
            : error.message
          : "Unknown TronScan error.";
      return { ok: false, error: message };
    }
  });
}

const TronScanRowSchema = z.object({
  blackAddress: z.string().optional(),
  tokenName: z.string().optional(),
  time: z.union([z.number(), z.string()]).optional(),
  transHash: z.string().optional(),
  contractAddress: z.string().optional(),
});

const TronScanBlacklistResponseSchema = z.object({
  total: z.number().optional(),
  data: z.array(TronScanRowSchema).optional(),
});

export async function checkTronScanUsdtBlacklist(address: string): Promise<TronScanBlacklistResult> {
  const cacheKey = sha256Key(["tronscan_blacklist", address]);
  return await getOrSetCache(cacheKey, 60_000, async () => {
    const url = `https://apilist.tronscanapi.com/api/stableCoin/blackList?blackAddress=${encodeURIComponent(
      address,
    )}`;
    try {
      const raw = await fetchTronScanJson(url, 8_000);
      const parsed = TronScanBlacklistResponseSchema.safeParse(raw);
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
  });
}

const TronScanTokenInfoSchema = z
  .object({
    tokenDecimal: z.number().optional(),
    tokenAbbr: z.string().optional(),
    tokenId: z.string().optional(),
    tokenName: z.string().optional(),
  })
  .passthrough();

const TronScanTokenTransferSchema = z
  .object({
    transaction_id: z.string(),
    block_ts: z.number(),
    from_address: z.string(),
    to_address: z.string(),
    contract_address: z.string().optional(),
    quant: z.string().optional(),
    tokenInfo: TronScanTokenInfoSchema.optional(),
  })
  .passthrough();

const TronScanTransfersResponseSchema = z.object({
  total: z.number().optional(),
  rangeTotal: z.number().optional(),
  token_transfers: z.array(TronScanTokenTransferSchema).optional(),
});

export type NormalizedUsdtTransfer = {
  txHash: string;
  timestampMs: number;
  from: string;
  to: string;
  amountBaseUnits: bigint; // USDT has 6 decimals; this is the integer base-unit amount
};

export type TransfersFetchResult =
  | {
      ok: true;
      transfers: NormalizedUsdtTransfer[];
      window: { fromTsMs: number; toTsMs: number };
      notices: string[];
    }
  | { ok: false; transfers: []; error: string };

export async function fetchUsdtTrc20Transfers(
  address: string,
  options?: {
    lookbackDays?: number;
    pageSize?: number;
    maxPages?: number;
    timeoutMs?: number;
  },
): Promise<TransfersFetchResult> {
  const cacheKey = sha256Key([
    "tronscan_usdt_transfers",
    address,
    options?.lookbackDays ?? 90,
    options?.pageSize ?? 50,
    options?.maxPages ?? 20,
  ]);
  return await getOrSetCache(cacheKey, 30_000, async () => {
  const lookbackDays = options?.lookbackDays ?? 90;
  const pageSize = Math.min(Math.max(options?.pageSize ?? 50, 10), 100);
  const maxPages = Math.min(Math.max(options?.maxPages ?? 20, 1), 200);
  const timeoutMs = options?.timeoutMs ?? 8_000;

  const now = Date.now();
  const cutoff = now - lookbackDays * 24 * 60 * 60 * 1000;

  const transfers: NormalizedUsdtTransfer[] = [];
  const notices: string[] = [];

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const start = page * pageSize;
      const url = `https://apilist.tronscanapi.com/api/token_trc20/transfers?limit=${pageSize}&start=${start}&sort=-timestamp&count=true&relatedAddress=${encodeURIComponent(
        address,
      )}&contract_address=${USDT_TRC20_CONTRACT}`;

      const raw = await fetchTronScanJson(url, timeoutMs);
      const parsed = TronScanTransfersResponseSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, transfers: [], error: "Unexpected TronScan transfers response." };

      const rows = parsed.data.token_transfers ?? [];
      if (rows.length === 0) break;

      for (const row of rows) {
        if (row.block_ts < cutoff) return { ok: true, transfers, window: { fromTsMs: cutoff, toTsMs: now }, notices };
        const quant = row.quant ?? "0";
        let amountBaseUnits: bigint;
        try {
          amountBaseUnits = BigInt(quant);
        } catch {
          amountBaseUnits = BigInt(0);
        }

        transfers.push({
          txHash: row.transaction_id,
          timestampMs: row.block_ts,
          from: row.from_address,
          to: row.to_address,
          amountBaseUnits,
        });
      }

      if (rows.length < pageSize) break;
    }

    if (transfers.length > 0 && transfers[transfers.length - 1]!.timestampMs >= cutoff) {
      notices.push("Transfer history may be incomplete due to pagination limits.");
    }

    return { ok: true, transfers, window: { fromTsMs: cutoff, toTsMs: now }, notices };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "TronScan timed out."
          : error.message
        : "Unknown TronScan error.";
    return { ok: false, transfers: [], error: message };
  }
  });
}
