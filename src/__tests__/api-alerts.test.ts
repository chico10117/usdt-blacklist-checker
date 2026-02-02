import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth }));

const getDb = vi.fn();
vi.mock("@/lib/db", () => ({ getDb }));

const listWatchlistEventsForUser = vi.fn();
vi.mock("@/lib/db/alerts", () => ({ listWatchlistEventsForUser }));

async function callGet(url = "http://localhost/api/alerts?limit=200") {
  const { GET } = await import("@/app/api/alerts/route");
  const req = new Request(url, { method: "GET" });
  const res = await GET(req);
  const json = await res.json().catch(() => null);
  return { res, json };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_123";
  process.env.CLERK_SECRET_KEY = "sk_test_123";
});

describe("/api/alerts", () => {
  it("returns 401 when unauthenticated and does not touch the DB", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callGet();
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(listWatchlistEventsForUser).not.toHaveBeenCalled();
  });

  it("returns 503 when persistence is disabled", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue(null);

    const { res } = await callGet();
    expect(res.status).toBe(503);
    expect(listWatchlistEventsForUser).not.toHaveBeenCalled();
  });

  it("returns 200 with items containing expected fields and does not leak internal data", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    listWatchlistEventsForUser.mockResolvedValue([
      {
        id: "event-001",
        watchlistItemId: "item-001",
        txHash: "0xabc123",
        tokenContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        amountBase: "1000000",
        fromAddress: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
        toAddress: "TV6MuMXfmLbBqPZvBHdwFsDnQAa4H1234",
        blockTsMs: "1704067200000",
        createdAt: new Date("2026-01-23T00:00:00.000Z"),
        address: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
        label: "Test Wallet",
      },
    ]);

    const { res, json } = await callGet("http://localhost/api/alerts?limit=50");
    expect(res.status).toBe(200);
    expect(listWatchlistEventsForUser).toHaveBeenCalledWith({}, "user_123", 50);

    expect(json?.items).toHaveLength(1);
    const item = json?.items?.[0];
    expect(item).toBeDefined();
    expect(item.id).toBe("event-001");
    expect(item.watchlistItemId).toBe("item-001");
    expect(item.txHash).toBe("0xabc123");
    expect(item.tokenContract).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
    expect(item.amountBase).toBe("1000000");
    expect(item.fromAddress).toBe("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb");
    expect(item.toAddress).toBe("TV6MuMXfmLbBqPZvBHdwFsDnQAa4H1234");
    expect(item.blockTsMs).toBe("1704067200000");
    expect(item.createdAt).toBe("2026-01-23T00:00:00.000Z");
    expect(item.address).toBe("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb");
    expect(item.label).toBe("Test Wallet");

    expect(item.userId).toBeUndefined();
    expect(item.addressHash).toBeUndefined();
  });

  it("clamps limit between 1 and 200", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    listWatchlistEventsForUser.mockResolvedValue([]);

    const { res: resLow } = await callGet("http://localhost/api/alerts?limit=0");
    expect(resLow.status).toBe(200);
    expect(listWatchlistEventsForUser).toHaveBeenLastCalledWith({}, "user_123", 1);

    const { res: resHigh } = await callGet("http://localhost/api/alerts?limit=999");
    expect(resHigh.status).toBe(200);
    expect(listWatchlistEventsForUser).toHaveBeenLastCalledWith({}, "user_123", 200);
  });
});
