import "server-only";

import type { DbClient } from "@/lib/db";
import {
  bulkInsertWatchlistEvents,
  listEnabledWatchlistItems,
  updateWatchlistItemCursor,
  type WatchlistEventInsert,
} from "@/lib/db/watchlist-alerts";
import { fetchTrc20TransfersSince, type NormalizedTrc20Transfer } from "@/lib/trc20/transfers";

const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export type RunAlertsOnceOptions = {
  maxItems?: number;
  limitPerItem?: number;
};

export type RunAlertsOnceResult = {
  processedItems: number;
  insertedEvents: number;
  errors: string[];
};

function filterTransfersByMinAmount(
  transfers: NormalizedTrc20Transfer[],
  minAmountBase: string | null,
): NormalizedTrc20Transfer[] {
  if (!minAmountBase) return transfers;

  const minAmount = BigInt(minAmountBase);
  return transfers.filter((t) => t.amountBaseUnits >= minAmount);
}

function transfersToEvents(
  itemId: string,
  tokenContract: string,
  transfers: NormalizedTrc20Transfer[],
): WatchlistEventInsert[] {
  return transfers.map((t) => ({
    watchlistItemId: itemId,
    txHash: t.txHash,
    tokenContract,
    amountBase: t.amountBaseUnits.toString(),
    fromAddress: t.from,
    toAddress: t.to,
    blockTsMs: String(t.timestampMs),
  }));
}

export async function runAlertsOnce(
  db: DbClient,
  options: RunAlertsOnceOptions = {},
): Promise<RunAlertsOnceResult> {
  const maxItems = Math.max(1, Math.min(100, options.maxItems ?? 50));
  const limitPerItem = Math.max(1, Math.min(100, options.limitPerItem ?? 50));

  const result: RunAlertsOnceResult = {
    processedItems: 0,
    insertedEvents: 0,
    errors: [],
  };

  // Load enabled watchlist items
  const items = await listEnabledWatchlistItems(db, maxItems);
  if (items.length === 0) {
    return result;
  }

  for (const item of items) {
    try {
      // Determine cursor (alertsCursorTsMs else Date.now())
      const startTimestampMs = item.alertsCursorTsMs
        ? parseInt(item.alertsCursorTsMs, 10)
        : Date.now();

      if (isNaN(startTimestampMs)) {
        result.errors.push(`Invalid cursor for item ${item.id}`);
        continue;
      }

      // Determine contract address
      const contractAddress = item.alertsTokenContract ?? USDT_TRC20_CONTRACT;

      // Fetch transfers since cursor
      const transferResult = await fetchTrc20TransfersSince({
        address: item.address,
        contractAddress,
        startTimestampMs,
        limit: limitPerItem,
      });

      if (!transferResult.ok) {
        result.errors.push(`Failed to fetch transfers for item ${item.id}: ${transferResult.error}`);
        continue;
      }

      // Filter by amount >= alertsMinAmountBase
      const filteredTransfers = filterTransfersByMinAmount(
        transferResult.transfers,
        item.alertsMinAmountBase,
      );

      // Convert to events and insert
      if (filteredTransfers.length > 0) {
        const events = transfersToEvents(item.id, contractAddress, filteredTransfers);
        const inserted = await bulkInsertWatchlistEvents(db, events);
        result.insertedEvents += inserted;
      }

      // Update cursor to last processed timestamp + 1
      if (transferResult.transfers.length > 0) {
        const lastTransfer = transferResult.transfers[transferResult.transfers.length - 1]!;
        const newCursor = String(lastTransfer.timestampMs + 1);
        await updateWatchlistItemCursor(db, item.id, newCursor);
      }

      result.processedItems++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`Error processing item ${item.id}: ${message}`);
    }
  }

  return result;
}
