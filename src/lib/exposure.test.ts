import { describe, expect, it } from "vitest";
import { computeTopInboundCounterparties } from "@/lib/exposure";

describe("computeTopInboundCounterparties", () => {
  it("aggregates and ranks inbound counterparties", () => {
    const subject = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    const nowMs = Date.parse("2026-01-22T00:00:00.000Z");

    const transfers = [
      // inbound: 20 USDT from A (older)
      {
        txHash: "tx1",
        timestampMs: nowMs - 2 * 24 * 60 * 60 * 1000,
        from: "TAfrom1111111111111111111111111111111111",
        to: subject,
        amountBaseUnits: BigInt("20000000"),
      },
      // inbound: 10 USDT from B (newer)
      {
        txHash: "tx2",
        timestampMs: nowMs - 1 * 24 * 60 * 60 * 1000,
        from: "TBfrom2222222222222222222222222222222222",
        to: subject,
        amountBaseUnits: BigInt("10000000"),
      },
      // inbound: 5 USDT from A (newest)
      {
        txHash: "tx3",
        timestampMs: nowMs - 12 * 60 * 60 * 1000,
        from: "TAfrom1111111111111111111111111111111111",
        to: subject,
        amountBaseUnits: BigInt("5000000"),
      },
      // outbound: ignored
      {
        txHash: "tx4",
        timestampMs: nowMs - 12 * 60 * 60 * 1000,
        from: subject,
        to: "TCto333333333333333333333333333333333333",
        amountBaseUnits: BigInt("999000000"),
      },
    ];

    const res = computeTopInboundCounterparties(transfers, subject, { nowMs, lookbackDays: 90, topN: 10 });
    expect(res.totalInboundAmount).toBe("35");
    expect(res.totalInboundTxCount).toBe(3);
    expect(res.top.length).toBe(2);
    expect(res.top[0]?.address).toBe("TAfrom1111111111111111111111111111111111");
    expect(res.top[0]?.inboundAmount).toBe("25");
    expect(res.top[0]?.inboundTxCount).toBe(2);
    expect(res.top[0]?.sampleTxHash).toBe("tx3");
  });
});
