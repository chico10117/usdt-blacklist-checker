import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth }));

const getDb = vi.fn();
vi.mock("@/lib/db", () => ({ getDb }));

const getUserSettings = vi.fn();
const upsertUserSettings = vi.fn();
vi.mock("@/lib/db/user-settings", () => ({ getUserSettings, upsertUserSettings }));

async function callGet() {
  const { GET } = await import("@/app/api/user-settings/route");
  const res = await GET();
  const json = await res.json();
  return { res, json };
}

async function callPatch(body: unknown) {
  const { PATCH } = await import("@/app/api/user-settings/route");
  const req = new Request("http://localhost/api/user-settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await PATCH(req);
  const json = await res.json();
  return { res, json };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_123";
  process.env.CLERK_SECRET_KEY = "sk_test_123";
});

describe("/api/user-settings", () => {
  it("returns 401 when unauthenticated and does not touch the DB", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callGet();
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(getUserSettings).not.toHaveBeenCalled();
  });

  it("returns loggingEnabled=false when no row exists (default)", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    getUserSettings.mockResolvedValue(null);

    const { res, json } = await callGet();
    expect(res.status).toBe(200);
    expect(json.loggingEnabled).toBe(false);
    expect(json.persistenceAvailable).toBe(true);
    expect(upsertUserSettings).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated updates with 401 and does not create rows", async () => {
    auth.mockResolvedValue({ userId: null });

    const { res } = await callPatch({ loggingEnabled: true });
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(upsertUserSettings).not.toHaveBeenCalled();
  });

  it("persists loggingEnabled via PATCH and returns the updated setting", async () => {
    auth.mockResolvedValue({ userId: "user_123" });
    getDb.mockReturnValue({});
    upsertUserSettings.mockResolvedValue({ loggingEnabled: true });

    const { res, json } = await callPatch({ loggingEnabled: true });
    expect(res.status).toBe(200);
    expect(json.loggingEnabled).toBe(true);
    expect(json.persistenceAvailable).toBe(true);
    expect(upsertUserSettings).toHaveBeenCalledWith({}, "user_123", true);
  });
});

