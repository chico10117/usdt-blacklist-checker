import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  normalizeExchangeTag,
  fetchExchangeLabel,
} from "@/lib/labels/exchange";
import * as tronscan from "@/lib/tronscan";
import * as cache from "@/lib/cache";

describe("normalizeExchangeTag", () => {
  it("returns null for non-string inputs", () => {
    expect(normalizeExchangeTag(null)).toBeNull();
    expect(normalizeExchangeTag(undefined)).toBeNull();
    expect(normalizeExchangeTag(123)).toBeNull();
    expect(normalizeExchangeTag({})).toBeNull();
  });

  it("returns null for unknown exchange tags", () => {
    expect(normalizeExchangeTag("unknown")).toBeNull();
    expect(normalizeExchangeTag("random exchange")).toBeNull();
    expect(normalizeExchangeTag("")).toBeNull();
  });

  it("normalizes exact exchange IDs (case insensitive)", () => {
    expect(normalizeExchangeTag("binance")).toBe("binance");
    expect(normalizeExchangeTag("Binance")).toBe("binance");
    expect(normalizeExchangeTag("BINANCE")).toBe("binance");
    expect(normalizeExchangeTag("  binance  ")).toBe("binance");

    expect(normalizeExchangeTag("okx")).toBe("okx");
    expect(normalizeExchangeTag("bybit")).toBe("bybit");
    expect(normalizeExchangeTag("htx")).toBe("htx");
    expect(normalizeExchangeTag("kucoin")).toBe("kucoin");
  });

  it("normalizes Binance variations", () => {
    expect(normalizeExchangeTag("binance.com")).toBe("binance");
    expect(normalizeExchangeTag("Binance Exchange")).toBe("binance");
    expect(normalizeExchangeTag("BNB")).toBe("binance");
  });

  it("normalizes OKX variations", () => {
    expect(normalizeExchangeTag("okex")).toBe("okx");
    expect(normalizeExchangeTag("OKCoin")).toBe("okx");
    expect(normalizeExchangeTag("OK Coin")).toBe("okx");
  });

  it("normalizes Bybit variations", () => {
    expect(normalizeExchangeTag("By Bit")).toBe("bybit");
  });

  it("normalizes HTX variations", () => {
    expect(normalizeExchangeTag("huobi")).toBe("htx");
    expect(normalizeExchangeTag("Huobi Global")).toBe("htx");
    expect(normalizeExchangeTag("HBTC")).toBe("htx");
  });

  it("normalizes Kucoin variations", () => {
    expect(normalizeExchangeTag("Ku Coin")).toBe("kucoin");
    expect(normalizeExchangeTag("KCS")).toBe("kucoin");
  });
});

describe("fetchExchangeLabel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Clear the actual cache to avoid test interference
    vi.spyOn(cache, "getOrSetCache").mockImplementation(async (_key, _ttl, fn) => {
      return await fn();
    });
  });

  it("returns null when fetch fails", async () => {
    vi.spyOn(tronscan, "fetchTronScanAccountTag").mockResolvedValue({
      ok: false,
      error: "Network error",
    });

    const result = await fetchExchangeLabel("TTest11111111111111111111111111111");
    expect(result).toBeNull();
  });

  it("returns exchange ID from publicTag when matched", async () => {
    vi.spyOn(tronscan, "fetchTronScanAccountTag").mockResolvedValue({
      ok: true,
      tag: { publicTag: "Binance" },
      evidenceUrl: "https://example.com",
    });

    const result = await fetchExchangeLabel("TTest11111111111111111111111111111");
    expect(result).toBe("binance");
  });

  it("returns exchange ID from blueTag when publicTag is not a match", async () => {
    vi.spyOn(tronscan, "fetchTronScanAccountTag").mockResolvedValue({
      ok: true,
      tag: { publicTag: "Unknown", blueTag: "OKX" },
      evidenceUrl: "https://example.com",
    });

    const result = await fetchExchangeLabel("TTest11111111111111111111111111111");
    expect(result).toBe("okx");
  });

  it("returns exchange ID from greyTag when others are not matches", async () => {
    vi.spyOn(tronscan, "fetchTronScanAccountTag").mockResolvedValue({
      ok: true,
      tag: { greyTag: "Bybit" },
      evidenceUrl: "https://example.com",
    });

    const result = await fetchExchangeLabel("TTest11111111111111111111111111111");
    expect(result).toBe("bybit");
  });

  it("returns exchange ID from redTag when others are not matches", async () => {
    vi.spyOn(tronscan, "fetchTronScanAccountTag").mockResolvedValue({
      ok: true,
      tag: { redTag: "Huobi" },
      evidenceUrl: "https://example.com",
    });

    const result = await fetchExchangeLabel("TTest11111111111111111111111111111");
    expect(result).toBe("htx");
  });

  it("returns null when no tags match known exchanges", async () => {
    vi.spyOn(tronscan, "fetchTronScanAccountTag").mockResolvedValue({
      ok: true,
      tag: { publicTag: "Some Random Tag", blueTag: "Another Tag" },
      evidenceUrl: "https://example.com",
    });

    const result = await fetchExchangeLabel("TTest11111111111111111111111111111");
    expect(result).toBeNull();
  });

  it("returns null when all tags are undefined", async () => {
    vi.spyOn(tronscan, "fetchTronScanAccountTag").mockResolvedValue({
      ok: true,
      tag: {},
      evidenceUrl: "https://example.com",
    });

    const result = await fetchExchangeLabel("TTest11111111111111111111111111111");
    expect(result).toBeNull();
  });

  it("uses cache to avoid repeated API calls", async () => {
    const mockFetch = vi.spyOn(tronscan, "fetchTronScanAccountTag").mockResolvedValue({
      ok: true,
      tag: { publicTag: "Kucoin" },
      evidenceUrl: "https://example.com",
    });

    // Mock cache to call the function (cache miss) on first call, then return cached value
    let callCount = 0;
    vi.spyOn(cache, "getOrSetCache").mockImplementation(async (_key, _ttl, fn) => {
      callCount++;
      if (callCount === 1) {
        return await fn();
      }
      // Second call - return cached value (simulated)
      return "kucoin";
    });

    const address = "TTest22222222222222222222222222222";

    // First call - should hit the API
    const result1 = await fetchExchangeLabel(address);
    expect(result1).toBe("kucoin");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    const result2 = await fetchExchangeLabel(address);
    expect(result2).toBe("kucoin");
    // Fetch should still only be called once since cache returns cached value
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("respects custom cache TTL", async () => {
    const mockGetOrSetCache = vi
      .spyOn(cache, "getOrSetCache")
      .mockImplementation(async (_key, _ttl, fn) => {
        return await fn();
      });

    vi.spyOn(tronscan, "fetchTronScanAccountTag").mockResolvedValue({
      ok: true,
      tag: { publicTag: "Binance" },
      evidenceUrl: "https://example.com",
    });

    await fetchExchangeLabel("TTest11111111111111111111111111111", {
      cacheTtlMs: 3600000,
    });

    expect(mockGetOrSetCache).toHaveBeenCalledWith(
      expect.any(String),
      3600000,
      expect.any(Function),
    );
  });

  it("passes timeout and retry options to fetchTronScanAccountTag", async () => {
    const mockFetch = vi.spyOn(tronscan, "fetchTronScanAccountTag").mockResolvedValue({
      ok: true,
      tag: { publicTag: "Binance" },
      evidenceUrl: "https://example.com",
    });

    await fetchExchangeLabel("TTest11111111111111111111111111111", {
      timeoutMs: 10000,
      maxRetries: 5,
    });

    expect(mockFetch).toHaveBeenCalledWith("TTest11111111111111111111111111111", {
      timeoutMs: 10000,
      maxRetries: 5,
    });
  });
});
