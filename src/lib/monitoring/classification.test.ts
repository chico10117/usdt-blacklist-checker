import { describe, expect, it } from "vitest";
import { classifyTransfer } from "@/lib/monitoring/classification";

describe("classifyTransfer", () => {
  it("classifies EXCHANGE_TO_EXCHANGE when both sides are exchanges", () => {
    const result = classifyTransfer({
      fromExchange: "binance",
      toExchange: "okx",
    });
    expect(result).toBe("EXCHANGE_TO_EXCHANGE");
  });

  it("classifies EXCHANGE_TO_EXCHANGE when both sides are same exchange", () => {
    const result = classifyTransfer({
      fromExchange: "binance",
      toExchange: "binance",
    });
    expect(result).toBe("EXCHANGE_TO_EXCHANGE");
  });

  it("classifies EXCHANGE_DEPOSIT when recipient is exchange", () => {
    const result = classifyTransfer({
      fromExchange: null,
      toExchange: "binance",
    });
    expect(result).toBe("EXCHANGE_DEPOSIT");
  });

  it("classifies EXCHANGE_DEPOSIT when sender is unknown but recipient is exchange", () => {
    const result = classifyTransfer({
      fromExchange: null,
      toExchange: "bybit",
    });
    expect(result).toBe("EXCHANGE_DEPOSIT");
  });

  it("classifies EXCHANGE_WITHDRAWAL when sender is exchange", () => {
    const result = classifyTransfer({
      fromExchange: "kucoin",
      toExchange: null,
    });
    expect(result).toBe("EXCHANGE_WITHDRAWAL");
  });

  it("classifies EXCHANGE_WITHDRAWAL when recipient is unknown but sender is exchange", () => {
    const result = classifyTransfer({
      fromExchange: "htx",
      toExchange: null,
    });
    expect(result).toBe("EXCHANGE_WITHDRAWAL");
  });

  it("classifies TRANSFER when neither side is exchange", () => {
    const result = classifyTransfer({
      fromExchange: null,
      toExchange: null,
    });
    expect(result).toBe("TRANSFER");
  });

  it("handles different exchange combinations for EXCHANGE_TO_EXCHANGE", () => {
    const exchanges: Array<{
      from: string;
      to: string;
    }> = [
      { from: "okx", to: "bybit" },
      { from: "htx", to: "kucoin" },
      { from: "kucoin", to: "binance" },
      { from: "bybit", to: "htx" },
    ];

    for (const { from, to } of exchanges) {
      const result = classifyTransfer({
        fromExchange: from,
        toExchange: to,
      });
      expect(result).toBe("EXCHANGE_TO_EXCHANGE");
    }
  });

  it("handles all exchange types for EXCHANGE_DEPOSIT", () => {
    const exchanges = ["binance", "okx", "bybit", "htx", "kucoin"];

    for (const exchange of exchanges) {
      const result = classifyTransfer({
        fromExchange: null,
        toExchange: exchange,
      });
      expect(result).toBe("EXCHANGE_DEPOSIT");
    }
  });

  it("handles all exchange types for EXCHANGE_WITHDRAWAL", () => {
    const exchanges = ["binance", "okx", "bybit", "htx", "kucoin"];

    for (const exchange of exchanges) {
      const result = classifyTransfer({
        fromExchange: exchange,
        toExchange: null,
      });
      expect(result).toBe("EXCHANGE_WITHDRAWAL");
    }
  });
});
