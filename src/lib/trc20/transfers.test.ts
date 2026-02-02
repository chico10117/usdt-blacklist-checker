import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchTrc20TransfersSince, NormalizedTrc20Transfer } from "./transfers";

// Mock the tronscan module
vi.mock("@/lib/tronscan", () => ({
  fetchTronScanJson: vi.fn(),
}));

import { fetchTronScanJson } from "@/lib/tronscan";

const mockedFetchTronScanJson = vi.mocked(fetchTronScanJson);

describe("fetchTrc20TransfersSince", () => {
  const mockAddress = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
  const mockContract = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // USDT
  const mockStartTime = 1700000000000; // Fixed timestamp

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid TRC20 transfers response correctly", async () => {
    const mockResponse = {
      total: 2,
      token_transfers: [
        {
          transaction_id: "tx1hash123",
          block_ts: 1700000001000,
          from_address: "TFrom111111111111111111111111111111111",
          to_address: mockAddress,
          contract_address: mockContract,
          quant: "1000000", // 1 USDT
          tokenInfo: { tokenDecimal: 6, tokenAbbr: "USDT" },
        },
        {
          transaction_id: "tx2hash456",
          block_ts: 1700000002000,
          from_address: mockAddress,
          to_address: "TTo2222222222222222222222222222222222",
          contract_address: mockContract,
          quant: "2000000", // 2 USDT
          tokenInfo: { tokenDecimal: 6, tokenAbbr: "USDT" },
        },
      ],
    };

    mockedFetchTronScanJson.mockResolvedValueOnce(mockResponse);

    const result = await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
      limit: 50,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.transfers).toHaveLength(2);
    expect(result.transfers[0]).toEqual({
      txHash: "tx1hash123",
      timestampMs: 1700000001000,
      from: "TFrom111111111111111111111111111111111",
      to: mockAddress,
      amountBaseUnits: BigInt("1000000"),
    });
    expect(result.transfers[1]).toEqual({
      txHash: "tx2hash456",
      timestampMs: 1700000002000,
      from: mockAddress,
      to: "TTo2222222222222222222222222222222222",
      amountBaseUnits: BigInt("2000000"),
    });
    expect(result.hasMore).toBe(false);
    expect(result.nextStartTimestampMs).toBeUndefined();
  });

  it("filters out transfers before startTimestampMs", async () => {
    const mockResponse = {
      total: 3,
      token_transfers: [
        {
          transaction_id: "tx1",
          block_ts: 1699999999000, // Before start time - should be filtered
          from_address: "TFrom1",
          to_address: mockAddress,
          contract_address: mockContract,
          quant: "1000000",
        },
        {
          transaction_id: "tx2",
          block_ts: 1700000000000, // At start time - should be included
          from_address: "TFrom2",
          to_address: mockAddress,
          contract_address: mockContract,
          quant: "2000000",
        },
        {
          transaction_id: "tx3",
          block_ts: 1700000001000, // After start time - should be included
          from_address: "TFrom3",
          to_address: mockAddress,
          contract_address: mockContract,
          quant: "3000000",
        },
      ],
    };

    mockedFetchTronScanJson.mockResolvedValueOnce(mockResponse);

    const result = await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.transfers).toHaveLength(2);
    expect(result.transfers[0]?.txHash).toBe("tx2");
    expect(result.transfers[1]?.txHash).toBe("tx3");
  });

  it("handles empty transfers response", async () => {
    mockedFetchTronScanJson.mockResolvedValueOnce({
      total: 0,
      token_transfers: [],
    });

    const result = await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.transfers).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextStartTimestampMs).toBeUndefined();
  });

  it("indicates hasMore=true when limit is reached", async () => {
    const transfers = Array.from({ length: 50 }, (_, i) => ({
      transaction_id: `tx${i}`,
      block_ts: mockStartTime + i * 1000,
      from_address: "TFrom",
      to_address: mockAddress,
      contract_address: mockContract,
      quant: "1000000",
    }));

    mockedFetchTronScanJson.mockResolvedValueOnce({
      total: 100,
      token_transfers: transfers,
    });

    const result = await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
      limit: 50,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.transfers).toHaveLength(50);
    expect(result.hasMore).toBe(true);
    expect(result.nextStartTimestampMs).toBe(mockStartTime + 49 * 1000 + 1);
  });

  it("clamps limit to valid range (1-100)", async () => {
    mockedFetchTronScanJson.mockResolvedValueOnce({
      total: 1,
      token_transfers: [
        {
          transaction_id: "tx1",
          block_ts: mockStartTime,
          from_address: "TFrom",
          to_address: mockAddress,
          contract_address: mockContract,
          quant: "1000000",
        },
      ],
    });

    // Test with limit too high
    await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
      limit: 200,
    });

    const urlHigh = mockedFetchTronScanJson.mock.calls[0]?.[0] as string;
    expect(urlHigh).toContain("limit=100");

    // Test with limit too low
    mockedFetchTronScanJson.mockResolvedValueOnce({
      total: 1,
      token_transfers: [
        {
          transaction_id: "tx1",
          block_ts: mockStartTime,
          from_address: "TFrom",
          to_address: mockAddress,
          contract_address: mockContract,
          quant: "1000000",
        },
      ],
    });

    await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
      limit: 0,
    });

    const urlLow = mockedFetchTronScanJson.mock.calls[1]?.[0] as string;
    expect(urlLow).toContain("limit=1");
  });

  it("handles invalid amount values gracefully", async () => {
    mockedFetchTronScanJson.mockResolvedValueOnce({
      total: 2,
      token_transfers: [
        {
          transaction_id: "tx1",
          block_ts: mockStartTime,
          from_address: "TFrom",
          to_address: mockAddress,
          contract_address: mockContract,
          quant: "invalid", // Invalid amount
        },
        {
          transaction_id: "tx2",
          block_ts: mockStartTime + 1000,
          from_address: "TFrom",
          to_address: mockAddress,
          contract_address: mockContract,
          quant: undefined, // Missing amount
        },
      ],
    });

    const result = await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.transfers[0]?.amountBaseUnits).toBe(BigInt(0));
    expect(result.transfers[1]?.amountBaseUnits).toBe(BigInt(0));
  });

  it("returns error for invalid response format", async () => {
    mockedFetchTronScanJson.mockResolvedValueOnce(null); // Invalid response

    const result = await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe("Unexpected TronScan transfers response format.");
  });

  it("handles fetch timeout errors", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockedFetchTronScanJson.mockRejectedValueOnce(abortError);

    const result = await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe("TronScan timed out.");
  });

  it("handles generic fetch errors", async () => {
    mockedFetchTronScanJson.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe("Network error");
  });

  it("includes start_timestamp in URL", async () => {
    mockedFetchTronScanJson.mockResolvedValueOnce({
      total: 1,
      token_transfers: [
        {
          transaction_id: "tx1",
          block_ts: mockStartTime,
          from_address: "TFrom",
          to_address: mockAddress,
          contract_address: mockContract,
          quant: "1000000",
        },
      ],
    });

    await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: 1700000000000,
    });

    const url = mockedFetchTronScanJson.mock.calls[0]?.[0] as string;
    expect(url).toContain("start_timestamp=1700000000000");
    expect(url).toContain("sort=timestamp");
  });

  it("passes timeout and retry options to fetchTronScanJson", async () => {
    mockedFetchTronScanJson.mockResolvedValueOnce({
      total: 0,
      token_transfers: [],
    });

    await fetchTrc20TransfersSince({
      address: mockAddress,
      contractAddress: mockContract,
      startTimestampMs: mockStartTime,
      timeoutMs: 5000,
      maxRetries: 2,
    });

    expect(mockedFetchTronScanJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        timeoutMs: 5000,
        maxRetries: 2,
      }),
    );
  });
});
