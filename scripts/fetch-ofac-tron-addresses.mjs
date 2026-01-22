import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import bs58 from "bs58";
import { sha256 } from "@noble/hashes/sha2.js";

const SOURCES = [
  { name: "OFAC SDN XML", url: "https://ofac.treasury.gov/sanctions-lists/sdn.xml" },
  { name: "OFAC SDN XML (legacy)", url: "https://www.treasury.gov/ofac/downloads/sdn.xml" },
  { name: "OFAC Additions CSV", url: "https://www.treasury.gov/ofac/downloads/add.csv" },
];

const TRON_ADDRESS_RE = /T[1-9A-HJ-NP-Za-km-z]{33}/g;

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function isValidTronAddress(address) {
  if (!address || typeof address !== "string") return false;
  if (!address.startsWith("T")) return false;
  let decoded;
  try {
    decoded = bs58.decode(address);
  } catch {
    return false;
  }
  if (decoded.length !== 25) return false;
  const payload = decoded.slice(0, 21);
  const checksum = decoded.slice(21, 25);
  if (payload[0] !== 0x41) return false;
  const hash1 = sha256(payload);
  const hash2 = sha256(hash1);
  const expectedChecksum = hash2.slice(0, 4);
  return bytesEqual(checksum, expectedChecksum);
}

function extractWithContext(text, { sourceUrl, sourceName }) {
  const matches = [];
  for (const match of text.matchAll(TRON_ADDRESS_RE)) {
    const address = match[0];
    if (!isValidTronAddress(address)) continue;
    const index = match.index ?? 0;
    const start = Math.max(0, index - 48);
    const end = Math.min(text.length, index + address.length + 48);
    const context = text.slice(start, end).replaceAll(/\s+/g, " ").trim();
    matches.push({ address, sourceUrl, sourceName, context });
  }
  return matches;
}

async function tryFetchText(url) {
  const res = await fetch(url, { headers: { accept: "*/*" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.text();
}

async function main() {
  const nowIso = new Date().toISOString();
  const all = [];
  const usedSources = [];

  for (const source of SOURCES) {
    try {
      const text = await tryFetchText(source.url);
      const hash = sha256Hex(text);
      const extracted = extractWithContext(text, { sourceUrl: source.url, sourceName: source.name });
      all.push(...extracted);
      usedSources.push({
        name: source.name,
        url: source.url,
        sha256: hash,
        lengthBytes: Buffer.byteLength(text),
      });
    } catch (error) {
      usedSources.push({
        name: source.name,
        url: source.url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const byAddress = new Map();
  for (const row of all) {
    const existing = byAddress.get(row.address) ?? [];
    existing.push({ url: row.sourceUrl, name: row.sourceName, context: row.context });
    byAddress.set(row.address, existing);
  }

  const addresses = [...byAddress.entries()]
    .map(([address, sources]) => ({ address, sources }))
    .sort((a, b) => a.address.localeCompare(b.address));

  const output = {
    generatedAtIso: nowIso,
    sources: usedSources,
    addressCount: addresses.length,
    addresses,
  };

  const outPath = path.join(process.cwd(), "src", "data", "ofac-tron-addresses.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

  process.stdout.write(`Wrote ${addresses.length} addresses to ${outPath}\n`);
}

main().catch((err) => {
  process.stderr.write((err instanceof Error ? err.stack : String(err)) + "\n");
  process.exit(1);
});
