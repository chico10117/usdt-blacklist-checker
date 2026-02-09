# Alerts v1 (Web-only) — Integrate wallet-monitor into usdt-blacklist-checker

Goal: add **web-only alerts** for TRON/TRC20 (starting with **USDT TRC20**) based on the user’s Watchlist.

- Deployment: already on **Vercel**.
- First version: **web feed only** (no Telegram in v1).
- Data sources: **TronScan public APIs** (optional key) + existing tag fetch (`fetchTronScanAccountTag`).

## Product UX (v1)
- User adds a TRON address to Watchlist (already exists).
- User enables Alerts for that item (toggle) + optional minimum amount.
- The site shows a **Recent Alerts** feed (last N events) with:
  - timestamp
  - amount (USDT)
  - from/to (truncated) + labels when available
  - classification: `EXCHANGE_DEPOSIT | EXCHANGE_WITHDRAWAL | EXCHANGE_TO_EXCHANGE | TRANSFER`
  - link to TronScan tx

## Architecture
- A server-side cron endpoint runs every 1–5 minutes:
  - pulls enabled watchlist items
  - fetches new TRC20 transfers since cursor
  - labels counterparties (top exchanges)
  - writes deduped events to DB
- The UI reads events from DB via `/api/alerts`.

## Implementation checklist

### 1) DB schema (Drizzle)
- [ ] Add columns to `watchlist_items`:
  - `alerts_enabled` boolean default false
  - `alerts_token_contract` text (default USDT TRC20)
  - `alerts_min_amount_base` text (base units as string, default "0")
  - `alerts_cursor_ts_ms` bigint-like (store as text or bigint if supported) default "0"
  - `alerts_cursor_tx` text nullable
  - `alerts_updated_at` timestamp
- [ ] Add table `watchlist_events`:
  - `id` uuid
  - `user_id` (FK)
  - `watchlist_item_id` (FK)
  - `tx_hash` text
  - `timestamp_ms` bigint-like
  - `from_address` text
  - `to_address` text
  - `amount_base_units` text
  - `token_contract` text
  - `classification` text
  - `from_label` text nullable
  - `to_label` text nullable
  - `created_at` timestamp
  - Unique index: `(watchlist_item_id, tx_hash)`

### 2) Transfer fetcher (TRC20)
- [ ] Add `src/lib/trc20/transfers.ts`:
  - `fetchTrc20TransfersSince({ address, contract, startTimestampMs, limit })`
  - Use TronScan endpoint that supports `start_timestamp` (no key required; optional key supported).
  - Normalize to a small shape: `{ txHash, tsMs, from, to, amountBaseUnits }`.

### 3) Labeling + classification
- [ ] Add `src/lib/labels/exchange.ts`:
  - `normalizeExchangeTag(tag: TronScanAccountTag): "binance"|"okx"|"bybit"|"htx"|"kucoin"|null`
  - Use `fetchTronScanAccountTag` and cache results (`getOrSetCache`).
- [ ] Add `classifyTransfer({ fromLabel, toLabel })`:
  - both exchange → `EXCHANGE_TO_EXCHANGE`
  - to exchange → `EXCHANGE_DEPOSIT`
  - from exchange → `EXCHANGE_WITHDRAWAL`
  - else → `TRANSFER`

### 4) Cron endpoint (Vercel Cron)
- [ ] Add `POST /api/cron/alerts`:
  - Protected by `CRON_SECRET` header/query.
  - For each enabled watchlist item:
    - read cursor
    - fetch new transfers since cursor
    - filter by `alerts_min_amount_base`
    - label from/to
    - compute classification
    - insert into `watchlist_events` (ignore duplicates)
    - advance cursor to newest processed tx

### 5) App API for the UI
- [ ] Add `GET /api/alerts?limit=200` (auth required):
  - list last N events for user (join to watchlist label/address)
- [ ] Add `POST /api/watchlist/:id/alerts` (auth required):
  - enable/disable alerts and set min amount

### 6) UI
- [ ] Update Watchlist UI to include:
  - toggle “Alerts” per item
  - min amount field (USDT)
  - “Recent alerts” section (table)

### 7) Tests
- [ ] Unit tests for:
  - classification rules
  - normalization of exchange tags
  - transfers parsing/dedupe logic
- [ ] API tests for `/api/alerts` and `/api/cron/alerts` using mocked fetch.

## Definition of Done (v1)
- [ ] `pnpm test` green
- [ ] Alerts feed works in UI for a logged-in user
- [ ] Vercel cron can run `/api/cron/alerts` safely (no logging of raw addresses)
- [ ] No Telegram in v1
