import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { buildGetSavedReportByIdQuery, buildListSavedReportsForAddressQuery } from "@/lib/db/saved-reports";
import { buildGetWatchlistItemByIdQuery, buildListWatchlistItemsForAddressQuery } from "@/lib/db/watchlist";
import * as schema from "@/lib/db/schema";

describe("scoped queries", () => {
  const originalKey = process.env.ADDRESS_HASH_KEY;

  const sqlClient = postgres("postgres://user:pass@127.0.0.1:5432/db", {
    max: 1,
    connect_timeout: 1,
    idle_timeout: 0,
  });
  const db = drizzle(sqlClient, { schema });

  beforeEach(() => {
    process.env.ADDRESS_HASH_KEY = "test-key";
  });

  afterEach(() => {
    if (originalKey) process.env.ADDRESS_HASH_KEY = originalKey;
    else delete process.env.ADDRESS_HASH_KEY;
  });

  afterAll(async () => {
    await sqlClient.end({ timeout: 0 });
  });

  it("always scopes saved report lookups by userId + id", () => {
    const { sql } = buildGetSavedReportByIdQuery(db, "user_a", "00000000-0000-0000-0000-000000000000").toSQL();
    expect(sql).toMatch(/"saved_reports"\."user_id"\s*=\s*\$/);
    expect(sql).toMatch(/"saved_reports"\."id"\s*=\s*\$/);
  });

  it("always scopes saved report lookups by userId + addressHash", () => {
    const { sql } = buildListSavedReportsForAddressQuery(db, "user_a", "T123").toSQL();
    expect(sql).toMatch(/"saved_reports"\."user_id"\s*=\s*\$/);
    expect(sql).toMatch(/"saved_reports"\."address_hash"\s*=\s*\$/);
  });

  it("always scopes watchlist lookups by userId + id", () => {
    const { sql } = buildGetWatchlistItemByIdQuery(db, "user_a", "00000000-0000-0000-0000-000000000000").toSQL();
    expect(sql).toMatch(/"watchlist_items"\."user_id"\s*=\s*\$/);
    expect(sql).toMatch(/"watchlist_items"\."id"\s*=\s*\$/);
  });

  it("always scopes watchlist lookups by userId + addressHash", () => {
    const { sql } = buildListWatchlistItemsForAddressQuery(db, "user_a", "T123").toSQL();
    expect(sql).toMatch(/"watchlist_items"\."user_id"\s*=\s*\$/);
    expect(sql).toMatch(/"watchlist_items"\."address_hash"\s*=\s*\$/);
  });
});

