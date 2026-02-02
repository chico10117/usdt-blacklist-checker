# ADR 0002 — Watchlist Alerts v1 (Web-only)

Date: 2026-02-02

## Context
The app already supports single-address screening for TRON USDT blacklist status and a richer `/api/analyze` endpoint.
It also has a Watchlist (auth-gated) stored in Postgres via Drizzle.

We want the first version of alerts to be **web-only** and run on Vercel.

## Decision
- Implement alerts as a **DB-backed event feed** per user.
- Populate events via a **server-side cron endpoint** called by Vercel Cron.
- Use **TronScan public APIs** (optional API key) and existing tag fetching for exchange labeling.
- No push notifications (Telegram/email) in v1.

## Details
- Users opt-in by enabling Alerts per watchlist item.
- Events are deduped by `(watchlist_item_id, tx_hash)`.
- Cursor per watchlist item prevents backfilling old transfers on first enable.

## Consequences
- Requires DB + migrations.
- Requires Vercel Cron configuration + secret.
- v1 is limited to the lookback window supported by the chosen TronScan transfer endpoint.

## Follow-ups
- Add Telegram notifications as v2.
- Add per-user notification settings.
- Add retention and caps for events.
