import { fetchTronScanAccountTag } from "@/lib/tronscan";
import { getOrSetCache } from "@/lib/cache";

export type ExchangeId = "binance" | "okx" | "bybit" | "htx" | "kucoin";

const EXCHANGE_IDS: readonly ExchangeId[] = ["binance", "okx", "bybit", "htx", "kucoin"];

/**
 * Best-effort normalization of an exchange tag string to a known ExchangeId.
 * Handles common variations and case-insensitive matching.
 */
export function normalizeExchangeTag(tag: unknown): ExchangeId | null {
  if (typeof tag !== "string") {
    return null;
  }

  const normalized = tag.toLowerCase().trim();

  // Direct match
  if ((EXCHANGE_IDS as readonly string[]).includes(normalized)) {
    return normalized as ExchangeId;
  }

  // Common variations
  const variations: Record<string, ExchangeId> = {
    // Binance variations
    "binance": "binance",
    "binance.com": "binance",
    "binance exchange": "binance",
    "bnb": "binance",
    // OKX variations
    "okx": "okx",
    "okex": "okx",
    "ok coin": "okx",
    "okcoin": "okx",
    // Bybit variations
    "bybit": "bybit",
    "by bit": "bybit",
    // HTX variations (formerly Huobi)
    "htx": "htx",
    "huobi": "htx",
    "huobi global": "htx",
    "hbtc": "htx",
    // Kucoin variations
    "kucoin": "kucoin",
    "ku coin": "kucoin",
    "kcs": "kucoin",
  };

  return variations[normalized] ?? null;
}

export type FetchExchangeLabelOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  cacheTtlMs?: number;
};

/**
 * Fetch exchange label for an address from TronScan account tags.
 * Returns null if no exchange tag is found or if the fetch fails.
 * Does not log addresses.
 */
export async function fetchExchangeLabel(
  address: string,
  opts?: FetchExchangeLabelOptions,
): Promise<ExchangeId | null> {
  const cacheTtlMs = opts?.cacheTtlMs ?? 6 * 60 * 60 * 1000; // 6 hours default

  const cacheKeyParts = ["exchange_label", address];
  const key = cacheKeyParts.join(":");

  return await getOrSetCache(key, cacheTtlMs, async () => {
    const result = await fetchTronScanAccountTag(address, {
      timeoutMs: opts?.timeoutMs,
      maxRetries: opts?.maxRetries,
    });

    if (!result.ok) {
      return null;
    }

    // Try tags in priority order: publicTag > blueTag > greyTag > redTag
    const tagSources = [
      result.tag.publicTag,
      result.tag.blueTag,
      result.tag.greyTag,
      result.tag.redTag,
    ];

    for (const tag of tagSources) {
      if (tag) {
        const exchangeId = normalizeExchangeTag(tag);
        if (exchangeId) {
          return exchangeId;
        }
      }
    }

    return null;
  });
}
