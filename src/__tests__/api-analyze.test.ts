import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth }));

const checkTronScanUsdtBlacklist = vi.fn();
const fetchUsdtTrc20Transfers = vi.fn();
vi.mock("@/lib/tronscan", () => ({
  checkTronScanUsdtBlacklist,
  fetchUsdtTrc20Transfers,
}));

const readUsdtBlacklistStatusOnChain = vi.fn();
vi.mock("@/lib/tron", () => ({
  readUsdtBlacklistStatusOnChain,
}));

const checkOfacSanctions = vi.fn();
vi.mock("@/lib/sanctions", () => ({
  checkOfacSanctions,
}));

const VALID_ADDRESS = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

async function callAnalyze(body: unknown) {
  const { POST } = await import("@/app/api/analyze/route");
  const req = new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "vitest" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const json = await res.json();
  return { res, json };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;

  checkTronScanUsdtBlacklist.mockResolvedValue({
    ok: true,
    blacklisted: false,
    evidence: { contractAddress: USDT_CONTRACT },
  });

  readUsdtBlacklistStatusOnChain.mockResolvedValue({
    ok: true,
    blacklisted: false,
    evidence: { contractAddress: USDT_CONTRACT, method: "getBlackListStatus", raw: "0", fullHost: "mock" },
  });

  checkOfacSanctions.mockReturnValue({
    ok: true,
    matched: false,
    matches: [],
    dataset: { generatedAtIso: "2026-01-01T00:00:00.000Z", sourceUrls: [], addressCount: 0 },
  });

  fetchUsdtTrc20Transfers.mockResolvedValue({
    ok: true,
    transfers: [
      {
        txHash: "tx_in_1",
        timestampMs: Date.parse("2026-01-21T12:00:00.000Z"),
        from: "TAfrom1111111111111111111111111111111111",
        to: VALID_ADDRESS,
        amountBaseUnits: BigInt("10000000"), // 10 USDT
      },
    ],
    window: { fromTsMs: Date.parse("2025-10-23T00:00:00.000Z"), toTsMs: Date.parse("2026-01-22T00:00:00.000Z") },
    notices: [],
  });
});

describe("/api/analyze", () => {
  it("returns free checks + 1-hop exposure, and locks advanced checks when unauthenticated", async () => {
    const { res, json } = await callAnalyze({ address: VALID_ADDRESS });
    expect(res.status).toBe(200);
    expect(json.address).toBe(VALID_ADDRESS);
    expect(json.risk?.score).toBeTypeOf("number");
    expect(json.checks?.sanctions?.ok).toBe(true);
    expect(json.access?.authenticated).toBe(false);
    expect(json.checks?.volume?.ok).toBe(false);
    expect(json.checks?.volume?.locked).toBe(true);
    expect(json.checks?.exposure1hop?.ok).toBe(true);
    expect(json.checks?.tracing2hop?.locked).toBe(true);
    expect(json.checks?.heuristics?.locked).toBe(true);
    expect(fetchUsdtTrc20Transfers).toHaveBeenCalled();
  });

  it("unlocks volume when authenticated and Clerk keys present", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_123";
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    auth.mockResolvedValue({ userId: "user_123" });

    const { res, json } = await callAnalyze({ address: VALID_ADDRESS });
    expect(res.status).toBe(200);
    expect(json.access?.authenticated).toBe(true);
    expect(json.checks?.volume?.ok).toBe(true);
    expect(json.checks?.tracing2hop?.ok).toBe(true);
    expect(json.checks?.heuristics?.ok).toBe(true);
    expect(json.risk?.score).toBe(5);
  });
});
