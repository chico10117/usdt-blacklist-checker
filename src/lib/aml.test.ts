import { describe, expect, it } from "vitest";
import { computeConfidencePercent, computeRiskScore, computeUsdtVolumeStats, formatUsdtFromBaseUnits } from "@/lib/aml";

describe("formatUsdtFromBaseUnits", () => {
  it("formats whole and fractional amounts", () => {
    expect(formatUsdtFromBaseUnits(BigInt(0))).toBe("0");
    expect(formatUsdtFromBaseUnits(BigInt("1000000"))).toBe("1");
    expect(formatUsdtFromBaseUnits(BigInt("1234500"))).toBe("1.2345");
  });
});

describe("computeUsdtVolumeStats", () => {
  it("computes 7/30/90 windows and largest transfers", () => {
    const address = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    const nowMs = Date.parse("2026-01-22T00:00:00.000Z");

    const transfers = [
      // inbound within 7d: 10 USDT
      {
        txHash: "tx_in_1",
        timestampMs: nowMs - 1 * 24 * 60 * 60 * 1000,
        from: "TAfrom1111111111111111111111111111111111",
        to: address,
        amountBaseUnits: BigInt("10000000"),
      },
      // outbound within 30d: 5 USDT
      {
        txHash: "tx_out_1",
        timestampMs: nowMs - 10 * 24 * 60 * 60 * 1000,
        from: address,
        to: "TBto111111111111111111111111111111111111",
        amountBaseUnits: BigInt("5000000"),
      },
      // inbound within 90d but outside 30d: 20 USDT (largest inbound)
      {
        txHash: "tx_in_2",
        timestampMs: nowMs - 60 * 24 * 60 * 60 * 1000,
        from: "TCfrom2222222222222222222222222222222222",
        to: address,
        amountBaseUnits: BigInt("20000000"),
      },
      // outside 90d: should be ignored
      {
        txHash: "tx_old",
        timestampMs: nowMs - 120 * 24 * 60 * 60 * 1000,
        from: "TDfrom3333333333333333333333333333333333",
        to: address,
        amountBaseUnits: BigInt("999000000"),
      },
    ];

    const stats = computeUsdtVolumeStats(transfers, address, nowMs);

    expect(stats.windows.d7.inbound.amount).toBe("10");
    expect(stats.windows.d7.inbound.txCount).toBe(1);
    expect(stats.windows.d7.outbound.amount).toBe("0");

    expect(stats.windows.d30.inbound.amount).toBe("10");
    expect(stats.windows.d30.outbound.amount).toBe("5");
    expect(stats.windows.d30.outbound.txCount).toBe(1);

    expect(stats.windows.d90.inbound.amount).toBe("30");
    expect(stats.windows.d90.inbound.txCount).toBe(2);

    expect(stats.largestInbound?.txHash).toBe("tx_in_2");
    expect(stats.largestInbound?.amount).toBe("20");
    expect(stats.largestOutbound?.txHash).toBe("tx_out_1");
  });
});

describe("computeRiskScore", () => {
  it("returns 100 when sanctioned", () => {
    const risk = computeRiskScore({
      blacklist: { status: "not_blacklisted", anyMethodBlacklisted: false },
      sanctionsMatched: true,
      confidencePercent: 90,
      volumeAvailable: false,
    });
    expect(risk.score).toBe(100);
    expect(risk.tier).toBe("severe");
  });

  it("returns 100 when consensus blacklisted", () => {
    const risk = computeRiskScore({
      blacklist: { status: "blacklisted", anyMethodBlacklisted: true },
      sanctionsMatched: false,
      confidencePercent: 90,
      volumeAvailable: false,
    });
    expect(risk.score).toBe(100);
    expect(risk.tier).toBe("severe");
  });

  it("returns elevated score when any method blacklisted but consensus inconclusive", () => {
    const risk = computeRiskScore({
      blacklist: { status: "inconclusive", anyMethodBlacklisted: true },
      sanctionsMatched: false,
      confidencePercent: 90,
      volumeAvailable: false,
    });
    expect(risk.score).toBeGreaterThanOrEqual(90);
    expect(risk.tier).toBe("severe");
  });
});

describe("computeConfidencePercent", () => {
  it("reduces confidence for locked and failed checks", () => {
    const confidence = computeConfidencePercent({
      lockedChecks: ["volume", "heuristics"],
      failedChecks: ["tronscan"],
      partialSignals: ["pagination_limited"],
    });
    expect(confidence).toBeLessThan(100);
    expect(confidence).toBeGreaterThanOrEqual(0);
  });
});
