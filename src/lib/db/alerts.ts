import "server-only";

import { desc, eq } from "drizzle-orm";

import type { DbClient } from "@/lib/db";
import { schema } from "@/lib/db";

export type WatchlistEventWithItem = {
  id: string;
  watchlistItemId: string;
  txHash: string;
  tokenContract: string;
  amountBase: string;
  fromAddress: string;
  toAddress: string;
  blockTsMs: string;
  createdAt: Date;
  address: string;
  label: string | null;
};

export function buildListWatchlistEventsForUserQuery(
  db: DbClient,
  userId: string,
  limit: number,
) {
  const clampedLimit = Math.max(1, Math.min(200, Math.round(limit)));

  return db
    .select({
      id: schema.watchlistEvents.id,
      watchlistItemId: schema.watchlistEvents.watchlistItemId,
      txHash: schema.watchlistEvents.txHash,
      tokenContract: schema.watchlistEvents.tokenContract,
      amountBase: schema.watchlistEvents.amountBase,
      fromAddress: schema.watchlistEvents.fromAddress,
      toAddress: schema.watchlistEvents.toAddress,
      blockTsMs: schema.watchlistEvents.blockTsMs,
      createdAt: schema.watchlistEvents.createdAt,
      address: schema.watchlistItems.address,
      label: schema.watchlistItems.label,
    })
    .from(schema.watchlistEvents)
    .innerJoin(
      schema.watchlistItems,
      eq(schema.watchlistEvents.watchlistItemId, schema.watchlistItems.id),
    )
    .where(eq(schema.watchlistItems.userId, userId))
    .orderBy(desc(schema.watchlistEvents.createdAt))
    .limit(clampedLimit);
}

export async function listWatchlistEventsForUser(
  db: DbClient,
  userId: string,
  limit: number,
): Promise<WatchlistEventWithItem[]> {
  const clampedLimit = Math.max(1, Math.min(200, Math.round(limit)));
  const rows = await buildListWatchlistEventsForUserQuery(db, userId, clampedLimit).execute();
  return rows;
}
