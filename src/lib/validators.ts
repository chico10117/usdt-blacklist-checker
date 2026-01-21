import bs58 from "bs58";
import { sha256 } from "@noble/hashes/sha2.js";
import { z } from "zod";

export type TronAddressValidation =
  | { ok: true; normalized: string }
  | { ok: false; normalized: string; error: string };

export function normalizeTronAddress(input: string): string {
  return input.trim();
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export function validateTronAddress(input: string): TronAddressValidation {
  const normalized = normalizeTronAddress(input);
  if (!normalized) return { ok: false, normalized, error: "Enter a TRON address." };
  if (!normalized.startsWith("T")) {
    return { ok: false, normalized, error: "TRON addresses start with “T”." };
  }

  let decoded: Uint8Array;
  try {
    decoded = bs58.decode(normalized);
  } catch {
    return { ok: false, normalized, error: "Invalid Base58 encoding." };
  }

  if (decoded.length !== 25) {
    return { ok: false, normalized, error: "Invalid TRON address length." };
  }

  const payload = decoded.slice(0, 21);
  const checksum = decoded.slice(21, 25);

  if (payload[0] !== 0x41) {
    return { ok: false, normalized, error: "Invalid TRON address prefix." };
  }

  const hash1 = sha256(payload);
  const hash2 = sha256(hash1);
  const expectedChecksum = hash2.slice(0, 4);

  if (!bytesEqual(checksum, expectedChecksum)) {
    return { ok: false, normalized, error: "Invalid TRON address checksum." };
  }

  return { ok: true, normalized };
}

export const TronAddressSchema = z
  .string()
  .transform((v) => normalizeTronAddress(v))
  .superRefine((value, ctx) => {
    const res = validateTronAddress(value);
    if (!res.ok) ctx.addIssue({ code: "custom", message: res.error });
  });

export const CheckRequestSchema = z.object({
  address: TronAddressSchema,
});
