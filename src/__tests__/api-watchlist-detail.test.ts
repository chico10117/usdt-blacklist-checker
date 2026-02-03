import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth }));

const getDb = vi.fn();
vi.mock("@/lib/db", () => ({ getDb }));

const deleteWatchlistItemById = vi.fn();
vi.mock("@/lib/db/watchlist", () => ({ deleteWatchlistItemById }));

async function callDelete(id: string) {
  const { DELETE } = await import("@/app/api/watchlist/[id]/route");
  const req = new Request(`http://localhost/api/watchlist/${id}`, {
    method: "DELETE",
    headers: { origin: "http://localhost", "x-forwarded-host": "localhost" },
  });
  const res = await DELETE(req as unknown as NextRequest, { params: Promise.resolve({ id }) });
  const json = await res.json().catch(() => null);
  return { res, json };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_123";
  process.env.CLERK_SECRET_KEY = "sk_test_123";
});

describe("/api/watchlist/[id]", () => {
  it("returns 401 when unauthenticated and does not touch the DB", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callDelete("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(deleteWatchlistItemById).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid ids", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});

    const { res } = await callDelete("not-a-uuid");
    expect(res.status).toBe(400);
    expect(deleteWatchlistItemById).not.toHaveBeenCalled();
  });

  it("returns 404 when the item does not exist for the current user", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    deleteWatchlistItemById.mockResolvedValue(null);

    const { res, json } = await callDelete("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
    expect(json?.error).toBe("Not found.");
    expect(deleteWatchlistItemById).toHaveBeenCalledWith({}, "user_123", "00000000-0000-0000-0000-000000000000");
  });

  it("deletes the item when found", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    deleteWatchlistItemById.mockResolvedValue({ id: "00000000-0000-0000-0000-000000000000" });

    const { res, json } = await callDelete("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(200);
    expect(json?.deleted).toBe(true);
  });
});
