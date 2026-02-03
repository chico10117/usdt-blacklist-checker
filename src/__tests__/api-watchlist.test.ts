import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth }));

const getDb = vi.fn();
vi.mock("@/lib/db", () => ({ getDb }));

const listWatchlistItems = vi.fn();
const listWatchlistItemsForAddress = vi.fn();
const createWatchlistItem = vi.fn();
vi.mock("@/lib/db/watchlist", () => ({ listWatchlistItems, listWatchlistItemsForAddress, createWatchlistItem }));

const ensureUserSettingsExists = vi.fn();
vi.mock("@/lib/db/user-settings", () => ({ ensureUserSettingsExists }));

const fetchUsdtBalance = vi.fn();
vi.mock("@/lib/tronscan", () => ({ fetchUsdtBalance }));

const VALID_ADDRESS = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";

async function callGet(url = "http://localhost/api/watchlist?limit=200") {
  const { GET } = await import("@/app/api/watchlist/route");
  const req = new Request(url, { method: "GET" });
  const res = await GET(req);
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function callPost(body: unknown) {
  const { POST } = await import("@/app/api/watchlist/route");
  const req = new Request("http://localhost/api/watchlist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "x-forwarded-host": "localhost",
    },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const json = await res.json().catch(() => null);
  return { res, json };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_123";
  process.env.CLERK_SECRET_KEY = "sk_test_123";
  process.env.ADDRESS_HASH_KEY = "test_hash_key";

  fetchUsdtBalance.mockResolvedValue({
    ok: true,
    balance: "0",
    balanceBaseUnits: "0",
    decimals: 6,
  });
});

describe("/api/watchlist", () => {
  it("GET returns 401 when unauthenticated and does not touch the DB", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callGet();
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(listWatchlistItems).not.toHaveBeenCalled();
  });

  it("GET returns 503 when persistence is disabled", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue(null);

    const { res } = await callGet();
    expect(res.status).toBe(503);
    expect(listWatchlistItems).not.toHaveBeenCalled();
  });

  it("GET lists items with clamped limit", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    listWatchlistItems.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000000",
        userId: "user_123",
        address: "T123",
        addressHash: "hash",
        label: null,
        createdAt: new Date("2026-01-23T00:00:00.000Z"),
      },
    ]);

    const { res, json } = await callGet("http://localhost/api/watchlist?limit=9999");
    expect(res.status).toBe(200);
    expect(listWatchlistItems).toHaveBeenCalledWith({}, "user_123", 200);
    expect(json?.items?.[0]?.createdAt).toBe("2026-01-23T00:00:00.000Z");
    expect(json?.items?.[0]?.addressHash).toBeUndefined();
    expect(json?.items?.[0]?.userId).toBeUndefined();
  });

  it("POST returns 401 when unauthenticated and does not touch the DB", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callPost({ address: VALID_ADDRESS, label: "Merchant A" });
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(createWatchlistItem).not.toHaveBeenCalled();
  });

  it("POST validates TRON address and does not write on invalid input", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});

    const { res, json } = await callPost({ address: "abc", label: "Merchant A" });
    expect(res.status).toBe(400);
    expect(String(json?.error)).toMatch(/TRON addresses start/);
    expect(listWatchlistItemsForAddress).not.toHaveBeenCalled();
    expect(ensureUserSettingsExists).not.toHaveBeenCalled();
    expect(createWatchlistItem).not.toHaveBeenCalled();
  });

  it("POST returns 409 when the address is already on the watchlist", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    listWatchlistItemsForAddress.mockResolvedValue([
      { id: "00000000-0000-0000-0000-000000000000", address: VALID_ADDRESS, label: null, createdAt: new Date() },
    ]);

    const { res } = await callPost({ address: VALID_ADDRESS, label: "Merchant A" });
    expect(res.status).toBe(409);
    expect(ensureUserSettingsExists).not.toHaveBeenCalled();
    expect(createWatchlistItem).not.toHaveBeenCalled();
  });

  it("POST creates a watchlist item and returns it", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    listWatchlistItemsForAddress.mockResolvedValue([]);
    createWatchlistItem.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000000",
      userId: "user_123",
      address: VALID_ADDRESS,
      addressHash: "hash",
      label: "Merchant A",
      usdtBalance: "0",
      createdAt: new Date("2026-01-23T00:00:00.000Z"),
    });

    const { res, json } = await callPost({ address: VALID_ADDRESS, label: " Merchant A " });
    expect(res.status).toBe(200);
    expect(ensureUserSettingsExists).toHaveBeenCalledWith({}, "user_123");
    expect(createWatchlistItem).toHaveBeenCalledWith({}, "user_123", { address: VALID_ADDRESS, label: "Merchant A", usdtBalance: "0" });
    expect(json?.item?.address).toBe(VALID_ADDRESS);
    expect(json?.item?.label).toBe("Merchant A");
    expect(json?.item?.createdAt).toBe("2026-01-23T00:00:00.000Z");
    expect(json?.item?.addressHash).toBeUndefined();
    expect(json?.item?.userId).toBeUndefined();
  });
});
