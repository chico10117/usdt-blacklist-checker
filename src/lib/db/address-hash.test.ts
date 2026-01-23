import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { computeAddressHash, normalizeAddress } from "@/lib/db/address-hash";

describe("address hashing", () => {
  const originalKey = process.env.ADDRESS_HASH_KEY;

  beforeEach(() => {
    process.env.ADDRESS_HASH_KEY = "test-key";
  });

  afterEach(() => {
    if (originalKey) process.env.ADDRESS_HASH_KEY = originalKey;
    else delete process.env.ADDRESS_HASH_KEY;
  });

  it("normalizes by trimming", () => {
    expect(normalizeAddress("  T123  ")).toBe("T123");
  });

  it("is deterministic for the same user+address", () => {
    const a = computeAddressHash("user_1", "T123");
    const b = computeAddressHash("user_1", "T123");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs across users for the same address (no collisions)", () => {
    const a = computeAddressHash("user_1", "T123");
    const b = computeAddressHash("user_2", "T123");
    expect(a).not.toBe(b);
  });

  it("requires a secret key", () => {
    delete process.env.ADDRESS_HASH_KEY;
    expect(() => computeAddressHash("user_1", "T123")).toThrow(/ADDRESS_HASH_KEY/);
  });
});

