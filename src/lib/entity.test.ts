import { describe, expect, it } from "vitest";
import { classifyEntityFromTagsAndTransfers } from "@/lib/entity";

describe("classifyEntityFromTagsAndTransfers", () => {
  it("classifies exchange when subject has exchange publicTag", () => {
    const res = classifyEntityFromTagsAndTransfers({
      address: "Tsubject11111111111111111111111111111111",
      nowMs: Date.parse("2026-01-22T00:00:00.000Z"),
      lookbackDays: 90,
      subjectTag: { publicTag: "Binance Hot Wallet(0)" },
      outboundTransfers: [],
      outboundDestTags: new Map(),
      topOutboundN: 10,
    });
    expect(res.ok).toBe(true);
    expect(res.kind).toBe("exchange");
  });

  it("classifies exchange when outbound goes mostly to exchange-tagged destinations", () => {
    const subject = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    const nowMs = Date.parse("2026-01-22T00:00:00.000Z");
    const transfers = [
      {
        txHash: "out1",
        timestampMs: nowMs - 60 * 60 * 1000,
        from: subject,
        to: "Tbinance1111111111111111111111111111111",
        amountBaseUnits: BigInt("900000000"), // 900 USDT
      },
      {
        txHash: "out2",
        timestampMs: nowMs - 30 * 60 * 1000,
        from: subject,
        to: "Tbinance1111111111111111111111111111111",
        amountBaseUnits: BigInt("100000000"), // 100 USDT
      },
    ];
    const destTags = new Map([["Tbinance1111111111111111111111111111111", { publicTag: "Binance Hot Wallet(1)" }]]);
    const res = classifyEntityFromTagsAndTransfers({
      address: subject,
      nowMs,
      lookbackDays: 90,
      outboundTransfers: transfers,
      outboundDestTags: destTags,
      topOutboundN: 10,
    });
    expect(res.kind).toBe("exchange");
    expect(res.label.toLowerCase()).toContain("exchange");
  });
});

