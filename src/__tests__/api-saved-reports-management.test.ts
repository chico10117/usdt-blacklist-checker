import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth }));

const getDb = vi.fn();
vi.mock("@/lib/db", () => ({ getDb }));

const listSavedReportsSummary = vi.fn();
const deleteAllSavedReportsForUser = vi.fn();
vi.mock("@/lib/db/saved-reports", () => ({ listSavedReportsSummary, deleteAllSavedReportsForUser }));

async function callGet(url = "http://localhost/api/saved-reports?limit=50") {
  const { GET } = await import("@/app/api/saved-reports/route");
  const req = new Request(url, { method: "GET" });
  const res = await GET(req);
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function callDelete() {
  const { DELETE } = await import("@/app/api/saved-reports/route");
  const res = await DELETE();
  const json = await res.json().catch(() => null);
  return { res, json };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_123";
  process.env.CLERK_SECRET_KEY = "sk_test_123";
});

describe("/api/saved-reports management", () => {
  it("GET returns 401 when unauthenticated and does not touch the DB", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callGet();
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(listSavedReportsSummary).not.toHaveBeenCalled();
  });

  it("GET returns 503 when persistence is disabled", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue(null);

    const { res } = await callGet();
    expect(res.status).toBe(503);
    expect(listSavedReportsSummary).not.toHaveBeenCalled();
  });

  it("GET lists reports with clamped limit", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    listSavedReportsSummary.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000000",
        address: "T123",
        riskScore: 50,
        riskTier: "elevated",
        confidence: 80,
        window: { lookbackDays: 90 },
        createdAt: new Date("2026-01-23T00:00:00.000Z"),
      },
    ]);

    const { res, json } = await callGet("http://localhost/api/saved-reports?limit=9999");
    expect(res.status).toBe(200);
    expect(listSavedReportsSummary).toHaveBeenCalledWith({}, "user_123", 100);
    expect(json?.reports?.[0]?.createdAt).toBe("2026-01-23T00:00:00.000Z");
  });

  it("DELETE returns 401 when unauthenticated and does not touch the DB", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callDelete();
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(deleteAllSavedReportsForUser).not.toHaveBeenCalled();
  });

  it("DELETE deletes all reports for the current user", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    deleteAllSavedReportsForUser.mockResolvedValue(7);

    const { res, json } = await callDelete();
    expect(res.status).toBe(200);
    expect(deleteAllSavedReportsForUser).toHaveBeenCalledWith({}, "user_123");
    expect(json?.deletedCount).toBe(7);
  });
});

