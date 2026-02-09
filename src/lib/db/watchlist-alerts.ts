import "server-only";

import { eq } from "drizzle-orm";

import type { DbClient } from "@/lib/db";
import { schema } from "@/lib/db";

export type EnabledWatchlistItem = {
  id: string;
  userId: string;
  address: string;
  alertsTokenContract: string | null;
  alertsMinAmountBase: string | null;
  alertsCursorTsMs: string | null;
};

export async function listEnabledWatchlistItems(
  db: DbClient,
  limit: number,
): Promise<EnabledWatchlistItem[]> {
  const rows = await db
    .select({
      id: schema.watchlistItems.id,
      userId: schema.watchlistItems.userId,
      address: schema.watchlistItems.address,
      alertsTokenContract: schema.watchlistItems.alertsTokenContract,
      alertsMinAmountBase: schema.watchlistItems.alertsMinAmountBase,
      alertsCursorTsMs: schema.watchlistItems.alertsCursorTsMs,
    })
    .from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.alertsEnabled, true))
    .orderBy(schema.watchlistItems.id)
    .limit(limit)
    .execute();

  return rows;
}

export async function updateWatchlistItemCursor(
  db: DbClient,
  itemId: string,
  newCursorTsMs: string,
): Promise<void> {
  await db
    .update(schema.watchlistItems)
    .set({
      alertsCursorTsMs: newCursorTsMs,
      alertsUpdatedAt: new Date(),
    })
    .where(eq(schema.watchlistItems.id, itemId))
    .execute();
}

export type WatchlistEventInsert = {
  watchlistItemId: string;
  txHash: string;
  tokenContract: string;
  amountBase: string;
  fromAddress: string;
  toAddress: string;
  blockTsMs: string;
};

export async function bulkInsertWatchlistEvents(
  db: DbClient,
  events: WatchlistEventInsert[],
): Promise<number> {
  if (events.length === 0) return 0;

  const values = events.map((e) => ({
    watchlistItemId: e.watchlistItemId,
    txHash: e.txHash,
    tokenContract: e.tokenContract,
    amountBase: e.amountBase,
    fromAddress: e.fromAddress,
    toAddress: e.toAddress,
    blockTsMs: e.blockTsMs,
  }));

  // Use onConflictDoNothing to ignore duplicates based on the unique constraint
  const result = await db
    .insert(schema.watchlistEvents)
    .values(values)
    .onConflictDoNothing({
      target: [schema.watchlistEvents.watchlistItemId, schema.watchlistEvents.txHash],
    })
    .execute();

  // Count actual inserts (this is approximate, may vary by driver)
  return result.length ?? 0;
}
