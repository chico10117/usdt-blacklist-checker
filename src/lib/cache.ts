import { createHash } from "node:crypto";

type CacheEntry<T> = { value: T; expiresAtMs: number };

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export function sha256Key(parts: Array<string | number | boolean | null | undefined>): string {
  const input = parts.map((p) => String(p ?? "")).join("|");
  return createHash("sha256").update(input).digest("hex");
}

export function readCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAtMs) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAtMs: Date.now() + ttlMs });
}

export async function getOrSetCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = readCache<T>(key);
  if (cached !== undefined) return cached;

  const existing = inFlight.get(key);
  if (existing) return (await existing) as T;

  const promise = fn()
    .then((value) => {
      writeCache(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return await promise;
}

