import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { DbClient } from "@/lib/db";
import { computeAddressHash } from "@/lib/db/address-hash";
import { schema } from "@/lib/db";

export type WatchlistItemCreateInput = {
  address: string;
  label?: string | null;
  usdtBalance?: string | null;
};

export function buildGetWatchlistItemByIdQuery(db: DbClient, userId: string, itemId: string) {
  return db
    .select()
    .from(schema.watchlistItems)
    .where(and(eq(schema.watchlistItems.userId, userId), eq(schema.watchlistItems.id, itemId)))
    .limit(1);
}

export async function getWatchlistItemById(db: DbClient, userId: string, itemId: string) {
  const rows = await buildGetWatchlistItemByIdQuery(db, userId, itemId).execute();
  return rows[0] ?? null;
}

export function buildListWatchlistItemsQuery(db: DbClient, userId: string, limit = 200) {
  return db
    .select()
    .from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.userId, userId))
    .orderBy(desc(schema.watchlistItems.createdAt))
    .limit(limit);
}

export async function listWatchlistItems(db: DbClient, userId: string, limit = 200) {
  return await buildListWatchlistItemsQuery(db, userId, limit).execute();
}

export function buildListWatchlistItemsForAddressQuery(db: DbClient, userId: string, address: string, limit = 200) {
  const addressHash = computeAddressHash(userId, address);
  return db
    .select()
    .from(schema.watchlistItems)
    .where(and(eq(schema.watchlistItems.userId, userId), eq(schema.watchlistItems.addressHash, addressHash)))
    .orderBy(desc(schema.watchlistItems.createdAt))
    .limit(limit);
}

export async function listWatchlistItemsForAddress(db: DbClient, userId: string, address: string, limit = 200) {
  return await buildListWatchlistItemsForAddressQuery(db, userId, address, limit).execute();
}

export async function createWatchlistItem(db: DbClient, userId: string, input: WatchlistItemCreateInput) {
  const addressHash = computeAddressHash(userId, input.address);

  const rows = await db
    .insert(schema.watchlistItems)
    .values({
      userId,
      address: input.address,
      addressHash,
      label: input.label ?? null,
      usdtBalance: input.usdtBalance ?? null,
    })
    .returning()
    .execute();

  return rows[0] ?? null;
}

export async function deleteWatchlistItemById(db: DbClient, userId: string, itemId: string) {
  const rows = await db
    .delete(schema.watchlistItems)
    .where(and(eq(schema.watchlistItems.userId, userId), eq(schema.watchlistItems.id, itemId)))
    .returning()
    .execute();

  return rows[0] ?? null;
}

export type WatchlistItemAlertsUpdateInput = {
  enabled: boolean;
  minAmountBase?: string | null;
};

export async function updateWatchlistItemAlerts(
  db: DbClient,
  userId: string,
  itemId: string,
  input: WatchlistItemAlertsUpdateInput,
) {
  const now = new Date();
  const updateData: Partial<typeof schema.watchlistItems.$inferInsert> = {
    alertsEnabled: input.enabled,
    alertsTokenContract: input.enabled ? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" : null, // USDT contract on TRON
    alertsMinAmountBase: input.enabled ? (input.minAmountBase ?? null) : null,
    alertsUpdatedAt: now,
  };

  if (input.enabled) {
    // Set cursor to current timestamp to avoid backfill
    updateData.alertsCursorTsMs = String(Date.now());
    updateData.alertsCursorTx = null;
  } else {
    updateData.alertsCursorTsMs = null;
    updateData.alertsCursorTx = null;
  }

  const rows = await db
    .update(schema.watchlistItems)
    .set(updateData)
    .where(and(eq(schema.watchlistItems.userId, userId), eq(schema.watchlistItems.id, itemId)))
    .returning()
    .execute();

  return rows[0] ?? null;
}
