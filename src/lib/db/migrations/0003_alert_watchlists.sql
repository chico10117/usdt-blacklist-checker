ALTER TABLE "watchlist_items" ADD COLUMN "alerts_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "watchlist_items" ADD COLUMN "alerts_token_contract" text;
ALTER TABLE "watchlist_items" ADD COLUMN "alerts_min_amount_base" text;
ALTER TABLE "watchlist_items" ADD COLUMN "alerts_cursor_ts_ms" text;
ALTER TABLE "watchlist_items" ADD COLUMN "alerts_cursor_tx" text;
ALTER TABLE "watchlist_items" ADD COLUMN "alerts_updated_at" timestamp with time zone;

CREATE TABLE "watchlist_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "watchlist_item_id" uuid NOT NULL REFERENCES "watchlist_items"("id") ON DELETE CASCADE,
  "tx_hash" text NOT NULL,
  "token_contract" text NOT NULL,
  "amount_base" text NOT NULL,
  "from_address" text NOT NULL,
  "to_address" text NOT NULL,
  "block_ts_ms" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "watchlist_events_item_tx_unique_idx" ON "watchlist_events"("watchlist_item_id", "tx_hash");
