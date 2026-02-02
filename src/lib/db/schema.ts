import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  loggingEnabled: boolean("logging_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedReports = pgTable(
  "saved_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => userSettings.userId, { onDelete: "cascade" }),
    address: text("address").notNull(),
    addressHash: text("address_hash").notNull(),
    riskScore: integer("risk_score").notNull(),
    riskTier: text("risk_tier").notNull(),
    confidence: integer("confidence").notNull(),
    window: jsonb("window").notNull(),
    reportJson: jsonb("report_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userAddressCreatedAt: index("saved_reports_user_address_created_at_idx").on(t.userId, t.addressHash, t.createdAt),
    userCreatedAt: index("saved_reports_user_created_at_idx").on(t.userId, t.createdAt),
  }),
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => userSettings.userId, { onDelete: "cascade" }),
    address: text("address").notNull(),
    addressHash: text("address_hash").notNull(),
    label: text("label"),
    usdtBalance: text("usdt_balance"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    alertsEnabled: boolean("alerts_enabled").notNull().default(false),
    alertsTokenContract: text("alerts_token_contract"),
    alertsMinAmountBase: text("alerts_min_amount_base"),
    alertsCursorTsMs: text("alerts_cursor_ts_ms"),
    alertsCursorTx: text("alerts_cursor_tx"),
    alertsUpdatedAt: timestamp("alerts_updated_at", { withTimezone: true }),
  },
  (t) => ({
    userAddressCreatedAt: index("watchlist_user_address_created_at_idx").on(t.userId, t.addressHash, t.createdAt),
    userCreatedAt: index("watchlist_user_created_at_idx").on(t.userId, t.createdAt),
  }),
);

export const watchlistEvents = pgTable(
  "watchlist_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchlistItemId: uuid("watchlist_item_id")
      .notNull()
      .references(() => watchlistItems.id, { onDelete: "cascade" }),
    txHash: text("tx_hash").notNull(),
    tokenContract: text("token_contract").notNull(),
    amountBase: text("amount_base").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    blockTsMs: text("block_ts_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    itemTxUnique: index("watchlist_events_item_tx_unique_idx").on(t.watchlistItemId, t.txHash),
  }),
);
