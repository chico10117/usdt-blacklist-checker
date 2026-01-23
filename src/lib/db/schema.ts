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
  },
  (t) => ({
    userAddressCreatedAt: index("watchlist_user_address_created_at_idx").on(t.userId, t.addressHash, t.createdAt),
    userCreatedAt: index("watchlist_user_created_at_idx").on(t.userId, t.createdAt),
  }),
);
