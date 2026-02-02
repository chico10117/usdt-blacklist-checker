import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
vi.mock("@/lib/db", () => ({ getDb }));

const runAlertsOnce = vi.fn();
vi.mock("@/lib/monitoring/alerts-runner", () => ({ runAlertsOnce }));

async function callPost(authHeader?: string) {
  const { POST } = await import("@/app/api/cron/alerts/route");
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  const req = new Request("http://localhost/api/cron/alerts", {
    method: "POST",
    headers,
  });
  const res = await POST(req);
  const json = await res.json().catch(() => null);
  return { res, json };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret-123";
});

describe("/api/cron/alerts", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const { res, json } = await callPost();
    expect(res.status).toBe(401);
    expect(json?.ok).toBe(false);
    expect(json?.error).toBe("Unauthorized");
    expect(getDb).not.toHaveBeenCalled();
    expect(runAlertsOnce).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header has wrong format", async () => {
    const { res, json } = await callPost("Basic dXNlcjpwYXNz");
    expect(res.status).toBe(401);
    expect(json?.ok).toBe(false);
    expect(json?.error).toBe("Unauthorized");
    expect(getDb).not.toHaveBeenCalled();
    expect(runAlertsOnce).not.toHaveBeenCalled();
  });

  it("returns 401 when Bearer token is wrong", async () => {
    const { res, json } = await callPost("Bearer wrong-secret");
    expect(res.status).toBe(401);
    expect(json?.ok).toBe(false);
    expect(json?.error).toBe("Unauthorized");
    expect(getDb).not.toHaveBeenCalled();
    expect(runAlertsOnce).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const { res, json } = await callPost("Bearer test-cron-secret-123");
    expect(res.status).toBe(401);
    expect(json?.ok).toBe(false);
    expect(json?.error).toBe("Unauthorized");
    expect(getDb).not.toHaveBeenCalled();
    expect(runAlertsOnce).not.toHaveBeenCalled();
  });

  it("returns 503 when persistence is disabled", async () => {
    getDb.mockReturnValue(null);

    const { res, json } = await callPost("Bearer test-cron-secret-123");
    expect(res.status).toBe(503);
    expect(json?.ok).toBe(false);
    expect(json?.error).toBe("Persistence is disabled");
    expect(runAlertsOnce).not.toHaveBeenCalled();
  });

  it("returns 200 with processed items and inserted events count", async () => {
    getDb.mockReturnValue({});
    runAlertsOnce.mockResolvedValue({
      processedItems: 5,
      insertedEvents: 12,
      errors: [],
    });

    const { res, json } = await callPost("Bearer test-cron-secret-123");
    expect(res.status).toBe(200);
    expect(json?.ok).toBe(true);
    expect(json?.processedItems).toBe(5);
    expect(json?.insertedEvents).toBe(12);
    expect(getDb).toHaveBeenCalled();
    expect(runAlertsOnce).toHaveBeenCalledWith({}, { maxItems: 50, limitPerItem: 50 });
  });

  it("returns 200 even when runner has errors", async () => {
    getDb.mockReturnValue({});
    runAlertsOnce.mockResolvedValue({
      processedItems: 3,
      insertedEvents: 7,
      errors: ["Error processing item abc: Network error"],
    });

    const { res, json } = await callPost("Bearer test-cron-secret-123");
    expect(res.status).toBe(200);
    expect(json?.ok).toBe(true);
    expect(json?.processedItems).toBe(3);
    expect(json?.insertedEvents).toBe(7);
  });

  it("returns 500 when runner throws an error", async () => {
    getDb.mockReturnValue({});
    runAlertsOnce.mockRejectedValue(new Error("Database connection failed"));

    const { res, json } = await callPost("Bearer test-cron-secret-123");
    expect(res.status).toBe(500);
    expect(json?.ok).toBe(false);
    expect(json?.error).toBe("Internal error");
  });

  it("is case-insensitive for Bearer prefix", async () => {
    getDb.mockReturnValue({});
    runAlertsOnce.mockResolvedValue({
      processedItems: 1,
      insertedEvents: 0,
      errors: [],
    });

    const { res, json } = await callPost("bearer test-cron-secret-123");
    expect(res.status).toBe(200);
    expect(json?.ok).toBe(true);
  });
});
