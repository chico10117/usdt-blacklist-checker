import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth }));

const getDb = vi.fn();
vi.mock("@/lib/db", () => ({ getDb }));

const updateWatchlistItemAlerts = vi.fn();
vi.mock("@/lib/db/watchlist", () => ({ updateWatchlistItemAlerts }));

const VALID_UUID = "00000000-0000-0000-0000-000000000000";

async function callPost(id: string, body: unknown) {
  const { POST } = await import("@/app/api/watchlist/[id]/alerts/route");
  const req = new Request(`http://localhost/api/watchlist/${id}/alerts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req as unknown as NextRequest, { params: Promise.resolve({ id }) });
  const json = await res.json().catch(() => null);
  return { res, json };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_123";
  process.env.CLERK_SECRET_KEY = "sk_test_123";
});

describe("/api/watchlist/[id]/alerts", () => {
  it("returns 401 when unauthenticated and does not touch the DB", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callPost(VALID_UUID, { enabled: true, minAmountUsdt: "100" });
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(updateWatchlistItemAlerts).not.toHaveBeenCalled();
  });

  it("returns 503 when persistence is disabled", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue(null);

    const { res } = await callPost(VALID_UUID, { enabled: true, minAmountUsdt: "100" });
    expect(res.status).toBe(503);
    expect(updateWatchlistItemAlerts).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid uuid", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});

    const { res } = await callPost("not-a-uuid", { enabled: true, minAmountUsdt: "100" });
    expect(res.status).toBe(400);
    expect(updateWatchlistItemAlerts).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON body", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});

    const { POST } = await import("@/app/api/watchlist/[id]/alerts/route");
    const req = new Request(`http://localhost/api/watchlist/${VALID_UUID}/alerts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-valid-json",
    });
    const res = await POST(req as unknown as NextRequest, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(400);
    expect(updateWatchlistItemAlerts).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid minAmountUsdt", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});

    const { res } = await callPost(VALID_UUID, { enabled: true, minAmountUsdt: "not-a-number" });
    expect(res.status).toBe(400);
    expect(updateWatchlistItemAlerts).not.toHaveBeenCalled();
  });

  it("returns 404 when the item does not exist for the current user", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    updateWatchlistItemAlerts.mockResolvedValue(null);

    const { res, json } = await callPost(VALID_UUID, { enabled: true, minAmountUsdt: "100" });
    expect(res.status).toBe(404);
    expect(json?.error).toBe("Not found.");
    expect(updateWatchlistItemAlerts).toHaveBeenCalledWith({}, "user_123", VALID_UUID, {
      enabled: true,
      minAmountBase: "100000000",
    });
  });

  it("200 updates with cursor set and converts USDT to base units", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    const mockUpdatedAt = new Date("2026-01-23T00:00:00.000Z");
    updateWatchlistItemAlerts.mockResolvedValue({
      id: VALID_UUID,
      alertsEnabled: true,
      alertsMinAmountBase: "100000000",
      alertsUpdatedAt: mockUpdatedAt,
    });

    const { res, json } = await callPost(VALID_UUID, { enabled: true, minAmountUsdt: "100" });
    expect(res.status).toBe(200);
    // 100 USDT = 100 * 10^6 = 100000000 base units
    expect(updateWatchlistItemAlerts).toHaveBeenCalledWith({}, "user_123", VALID_UUID, {
      enabled: true,
      minAmountBase: "100000000",
    });
    expect(json?.item?.id).toBe(VALID_UUID);
    expect(json?.item?.alertsEnabled).toBe(true);
    expect(json?.item?.alertsMinAmountBase).toBe("100000000");
    expect(json?.item?.alertsUpdatedAt).toBe("2026-01-23T00:00:00.000Z");
  });

  it("200 disables alerts without minAmount", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    const mockUpdatedAt = new Date("2026-01-23T00:00:00.000Z");
    updateWatchlistItemAlerts.mockResolvedValue({
      id: VALID_UUID,
      alertsEnabled: false,
      alertsMinAmountBase: null,
      alertsUpdatedAt: mockUpdatedAt,
    });

    const { res, json } = await callPost(VALID_UUID, { enabled: false });
    expect(res.status).toBe(200);
    expect(updateWatchlistItemAlerts).toHaveBeenCalledWith({}, "user_123", VALID_UUID, {
      enabled: false,
      minAmountBase: null,
    });
    expect(json?.item?.alertsEnabled).toBe(false);
    expect(json?.item?.alertsMinAmountBase).toBeNull();
  });

  it("200 enables alerts with decimal USDT amount", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    const mockUpdatedAt = new Date("2026-01-23T00:00:00.000Z");
    updateWatchlistItemAlerts.mockResolvedValue({
      id: VALID_UUID,
      alertsEnabled: true,
      alertsMinAmountBase: "50000000",
      alertsUpdatedAt: mockUpdatedAt,
    });

    const { res, json } = await callPost(VALID_UUID, { enabled: true, minAmountUsdt: "50.5" });
    expect(res.status).toBe(200);
    // 50.5 USDT = 50.5 * 10^6 = 50500000 base units
    expect(updateWatchlistItemAlerts).toHaveBeenCalledWith({}, "user_123", VALID_UUID, {
      enabled: true,
      minAmountBase: "50500000",
    });
    expect(json?.item?.alertsMinAmountBase).toBe("50000000");
  });
});
