import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth }));

const getDb = vi.fn();
vi.mock("@/lib/db", () => ({ getDb }));

const getUserSettings = vi.fn();
vi.mock("@/lib/db/user-settings", () => ({ getUserSettings }));

const createSavedReport = vi.fn();
vi.mock("@/lib/db/saved-reports", () => ({ createSavedReport }));

const VALID_ADDRESS = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";

async function callPost(body: unknown) {
  const { POST } = await import("@/app/api/saved-reports/route");
  const req = new Request("http://localhost/api/saved-reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
});

describe("/api/saved-reports", () => {
  it("returns 401 when unauthenticated and does not touch the DB", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callPost({ address: VALID_ADDRESS, report: {} });
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(getUserSettings).not.toHaveBeenCalled();
    expect(createSavedReport).not.toHaveBeenCalled();
  });

  it("returns 503 when persistence is disabled", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue(null);

    const { res, json } = await callPost({ address: VALID_ADDRESS, report: {} });
    expect(res.status).toBe(503);
    expect(json?.error).toBeTypeOf("string");
    expect(getUserSettings).not.toHaveBeenCalled();
    expect(createSavedReport).not.toHaveBeenCalled();
  });

  it("returns 403 when loggingEnabled is false and does not create rows", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    getUserSettings.mockResolvedValue({ loggingEnabled: false });

    const { res } = await callPost({ address: VALID_ADDRESS, report: {} });
    expect(res.status).toBe(403);
    expect(createSavedReport).not.toHaveBeenCalled();
  });

  it("validates payload and rejects mismatched report addresses", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    getUserSettings.mockResolvedValue({ loggingEnabled: true });

    const report = { address: "TA3941uFAvmVibSkQ6fMJXxmaSNovX86mz", risk: { score: 10, tier: "low", confidence: 80 } };
    const { res } = await callPost({ address: VALID_ADDRESS, report });
    expect(res.status).toBe(400);
    expect(createSavedReport).not.toHaveBeenCalled();
  });

  it("creates a SavedReport and returns its id", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    getUserSettings.mockResolvedValue({ loggingEnabled: true });
    createSavedReport.mockResolvedValue({ id: "00000000-0000-0000-0000-000000000000", createdAt: new Date("2026-01-23T00:00:00.000Z") });

    const report = {
      address: VALID_ADDRESS,
      risk: { score: 55.2, tier: "high", confidence: 91.7 },
      checks: { exposure1hop: { ok: true, window: { lookbackDays: 90 } } },
    };

    const { res, json } = await callPost({ address: VALID_ADDRESS, report });
    expect(res.status).toBe(200);
    expect(json?.id).toBe("00000000-0000-0000-0000-000000000000");
    expect(createSavedReport).toHaveBeenCalledWith(
      {},
      "user_123",
      expect.objectContaining({
        address: VALID_ADDRESS,
        riskScore: 55,
        riskTier: "high",
        confidence: 92,
        window: { lookbackDays: 90 },
      }),
    );
  });
});
