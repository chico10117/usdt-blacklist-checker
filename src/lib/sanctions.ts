import ofacTronAddresses from "@/data/ofac-tron-addresses.json";
import { normalizeTronAddress, validateTronAddress } from "@/lib/validators";

export type SanctionsMatch = {
  address: string;
  sources: Array<{ name?: string; url: string; context?: string }>;
};

export type OfacDatasetInfo = {
  generatedAtIso: string;
  sourceUrls: string[];
  addressCount: number;
};

export type SanctionsCheckResult =
  | { ok: true; matched: boolean; matches: SanctionsMatch[]; dataset: OfacDatasetInfo }
  | { ok: false; matched: false; error: string; dataset?: OfacDatasetInfo };

let addressToMatch: Map<string, SanctionsMatch> | null = null;

function getDatasetInfo(): OfacDatasetInfo {
  return {
    generatedAtIso: ofacTronAddresses.generatedAtIso,
    sourceUrls: (ofacTronAddresses.sources ?? [])
      .map((s) => s.url)
      .filter((v): v is string => typeof v === "string"),
    addressCount: ofacTronAddresses.addressCount ?? (ofacTronAddresses.addresses?.length ?? 0),
  };
}

function getAddressMap(): Map<string, SanctionsMatch> {
  if (addressToMatch) return addressToMatch;
  const map = new Map<string, SanctionsMatch>();

  for (const entry of ofacTronAddresses.addresses ?? []) {
    const normalized = normalizeTronAddress(entry.address);
    if (!validateTronAddress(normalized).ok) continue;
    map.set(normalized, {
      address: normalized,
      sources: (entry.sources ?? []).map((s) => ({
        name: typeof s?.name === "string" ? s.name : undefined,
        url: String(s?.url ?? ""),
        context: typeof s?.context === "string" ? s.context : undefined,
      })),
    });
  }

  addressToMatch = map;
  return map;
}

export function checkOfacSanctions(address: string): SanctionsCheckResult {
  const dataset = getDatasetInfo();
  const normalized = normalizeTronAddress(address);
  const valid = validateTronAddress(normalized);
  if (!valid.ok) return { ok: false, matched: false, error: valid.error, dataset };

  const matches = [];
  const map = getAddressMap();
  const hit = map.get(valid.normalized);
  if (hit) matches.push(hit);

  return { ok: true, matched: matches.length > 0, matches, dataset };
}

