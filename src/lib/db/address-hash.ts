import "server-only";

import { createHmac } from "crypto";

function requireAddressHashKey(): string {
  const key = process.env.ADDRESS_HASH_KEY;
  if (!key) throw new Error("Persistence is disabled (ADDRESS_HASH_KEY not set).");
  return key;
}

export function normalizeAddress(address: string): string {
  return address.trim();
}

export function computeAddressHash(userId: string, address: string): string {
  const key = requireAddressHashKey();
  const normalizedAddress = normalizeAddress(address);
  return createHmac("sha256", key).update(`${userId}:${normalizedAddress}`, "utf8").digest("hex");
}

