import { describe, expect, it } from "vitest";
import ofacTronAddresses from "@/data/ofac-tron-addresses.json";
import { checkOfacSanctions } from "@/lib/sanctions";
import { validateTronAddress } from "@/lib/validators";

describe("checkOfacSanctions", () => {
  it("rejects invalid TRON addresses", () => {
    const res = checkOfacSanctions("not-an-address");
    expect(res.ok).toBe(false);
  });

  it("matches a known address from the dataset (if present)", () => {
    expect(ofacTronAddresses.addresses.length).toBeGreaterThan(0);
    const sample = ofacTronAddresses.addresses.find((a) => validateTronAddress(a.address).ok)?.address;
    expect(sample).toBeTypeOf("string");
    if (typeof sample !== "string") return;
    const res = checkOfacSanctions(sample);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.matched).toBe(true);
      expect(res.matches[0]?.address).toBe(sample);
      expect(res.dataset.addressCount).toBeGreaterThan(0);
    }
  });
});
