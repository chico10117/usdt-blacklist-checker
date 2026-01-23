import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("db", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
    else delete process.env.DATABASE_URL;
  });

  it("returns null when DATABASE_URL is missing", async () => {
    const { getDb } = await import("./index");
    expect(getDb()).toBeNull();
  });
});

