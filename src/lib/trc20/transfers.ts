import { z } from "zod";
import { fetchTronScanJson, TronScanFetchOptions } from "@/lib/tronscan";

export type NormalizedTrc20Transfer = {
  txHash: string;
  timestampMs: number;
  from: string;
  to: string;
  amountBaseUnits: bigint;
};

export type FetchTrc20TransfersSinceOptions = {
  address: string;
  contractAddress: string;
  startTimestampMs: number;
  limit?: number;
  timeoutMs?: number;
  maxRetries?: number;
};

export type TransfersSinceResult =
  | {
      ok: true;
      transfers: NormalizedTrc20Transfer[];
      hasMore: boolean;
      nextStartTimestampMs?: number;
    }
  | { ok: false; error: string };

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

/**
 * Fetch TRC20 transfers for an address starting from a specific timestamp.
 * Uses TronScan public API with start_timestamp cursor support.
 * No API key required for public endpoints.
 */
export async function fetchTrc20TransfersSince(
  options: FetchTrc20TransfersSinceOptions,
): Promise<TransfersSinceResult> {
  const { address, contractAddress, startTimestampMs, limit = 50, timeoutMs = 8_000, maxRetries = 3 } = options;

  const validatedLimit = Math.min(Math.max(limit, 1), 100);

  // Build URL with start_timestamp parameter for cursor-based pagination
  // Using the transfers endpoint with start_timestamp filter
  const url = new URL("https://apilist.tronscanapi.com/api/token_trc20/transfers");
  url.searchParams.set("relatedAddress", address);
  url.searchParams.set("contract_address", contractAddress);
  url.searchParams.set("limit", String(validatedLimit));
  url.searchParams.set("start_timestamp", String(startTimestampMs));
  url.searchParams.set("sort", "timestamp"); // Ascending order for cursor-based fetching

  try {
    const raw = await fetchTronScanJson(url.toString(), { timeoutMs, maxRetries } as TronScanFetchOptions);
    const parsed = TronScanTransfersResponseSchema.safeParse(raw);

    if (!parsed.success) {
      return { ok: false, error: "Unexpected TronScan transfers response format." };
    }

    const rows = parsed.data.token_transfers ?? [];

    const transfers: NormalizedTrc20Transfer[] = [];
    for (const row of rows) {
      // Only include transfers that are >= startTimestampMs
      if (row.block_ts < startTimestampMs) continue;

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

    // Determine if there are more results
    // If we got exactly the limit requested, there might be more
    const hasMore = rows.length >= validatedLimit;

    // Calculate next start timestamp for pagination
    // Use the last transfer's timestamp + 1ms to avoid duplicates
    let nextStartTimestampMs: number | undefined;
    if (hasMore && transfers.length > 0) {
      const lastTimestamp = transfers[transfers.length - 1]!.timestampMs;
      nextStartTimestampMs = lastTimestamp + 1;
    }

    return {
      ok: true,
      transfers,
      hasMore,
      nextStartTimestampMs,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "TronScan timed out."
          : error.message
        : "Unknown TronScan error.";
    return { ok: false, error: message };
  }
}
