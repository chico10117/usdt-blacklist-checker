import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth }));

const getDb = vi.fn();
vi.mock("@/lib/db", () => ({ getDb }));

const getSavedReportById = vi.fn();
const deleteSavedReportById = vi.fn();
vi.mock("@/lib/db/saved-reports", () => ({ getSavedReportById, deleteSavedReportById }));

async function callGet(id: string) {
  const { GET } = await import("@/app/api/saved-reports/[id]/route");
  const req = new Request(`http://localhost/api/saved-reports/${id}`, { method: "GET" });
  const res = await GET(req as unknown as NextRequest, { params: Promise.resolve({ id }) });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function callDelete(id: string) {
  const { DELETE } = await import("@/app/api/saved-reports/[id]/route");
  const req = new Request(`http://localhost/api/saved-reports/${id}`, {
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

describe("/api/saved-reports/[id]", () => {
  it("returns 401 when unauthenticated and does not touch the DB", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callGet("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(getSavedReportById).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid ids", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});

    const { res } = await callGet("not-a-uuid");
    expect(res.status).toBe(400);
    expect(getSavedReportById).not.toHaveBeenCalled();
  });

  it("returns 404 without leaking existence when the row is not found", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    getSavedReportById.mockResolvedValue(null);

    const { res, json } = await callGet("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
    expect(json?.error).toBe("Not found.");
    expect(getSavedReportById).toHaveBeenCalledWith({}, "user_123", "00000000-0000-0000-0000-000000000000");
  });

  it("returns the saved report JSON when found", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    getSavedReportById.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000000",
      userId: "user_123",
      address: "T123",
      addressHash: "hash",
      riskScore: 10,
      riskTier: "low",
      confidence: 90,
      window: { lookbackDays: 90 },
      reportJson: { address: "T123", risk: { score: 10, tier: "low", confidence: 90 } },
      createdAt: new Date("2026-01-23T00:00:00.000Z"),
    });

    const { res, json } = await callGet("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(200);
    expect(json?.id).toBe("00000000-0000-0000-0000-000000000000");
    expect(json?.createdAt).toBe("2026-01-23T00:00:00.000Z");
    expect(json?.reportJson?.address).toBe("T123");
  });

  it("DELETE returns 404 when the report does not exist for the current user", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    deleteSavedReportById.mockResolvedValue(null);

    const { res, json } = await callDelete("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
    expect(json?.error).toBe("Not found.");
    expect(deleteSavedReportById).toHaveBeenCalledWith({}, "user_123", "00000000-0000-0000-0000-000000000000");
  });
});
