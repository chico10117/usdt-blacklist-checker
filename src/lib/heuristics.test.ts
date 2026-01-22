import { describe, expect, it } from "vitest";
import { computeFlowHeuristics } from "@/lib/heuristics";

describe("computeFlowHeuristics", () => {
  it("flags fast-in / fast-out", () => {
    const subject = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    const nowMs = Date.parse("2026-01-22T00:00:00.000Z");
    const transfers = [
      {
        txHash: "in1",
        timestampMs: nowMs - 60 * 60 * 1000,
        from: "TAfrom1111111111111111111111111111111111",
        to: subject,
        amountBaseUnits: BigInt("1000000000"), // 1000 USDT
      },
      {
        txHash: "out1",
        timestampMs: nowMs - 30 * 60 * 1000,
        from: subject,
        to: "TBto222222222222222222222222222222222222",
        amountBaseUnits: BigInt("800000000"), // 800 USDT
      },
    ];

    const res = computeFlowHeuristics(transfers, subject, { nowMs });
    expect(res.ok).toBe(true);
    expect(res.findings.some((f) => f.key === "fast_in_fast_out")).toBe(true);
  });

  it("flags structuring-like inbound deposits", () => {
    const subject = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    const nowMs = Date.parse("2026-01-22T00:00:00.000Z");

    const transfers = Array.from({ length: 20 }, (_, i) => ({
      txHash: `s${i}`,
      timestampMs: nowMs - i * 60 * 1000,
      from: "TAfrom1111111111111111111111111111111111",
      to: subject,
      amountBaseUnits: BigInt("50000000"), // 50 USDT
    }));

    const res = computeFlowHeuristics(transfers, subject, { nowMs });
    expect(res.findings.some((f) => f.key === "structuring_like")).toBe(true);
  });

  it("flags peel-like outflow burst after large inbound", () => {
    const subject = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    const nowMs = Date.parse("2026-01-22T00:00:00.000Z");

    const transfers = [
      {
        txHash: "pin",
        timestampMs: nowMs - 5 * 60 * 60 * 1000,
        from: "TAfrom1111111111111111111111111111111111",
        to: subject,
        amountBaseUnits: BigInt("10000000000"), // 10000 USDT
      },
      ...Array.from({ length: 10 }, (_, i) => ({
        txHash: `pout${i}`,
        timestampMs: nowMs - (4 * 60 * 60 * 1000 - i * 60 * 1000),
        from: subject,
        to: "TBto222222222222222222222222222222222222",
        amountBaseUnits: BigInt("100000000"), // 100 USDT
      })),
    ];

    const res = computeFlowHeuristics(transfers, subject, { nowMs });
    expect(res.findings.some((f) => f.key === "peel_like")).toBe(true);
  });
});

