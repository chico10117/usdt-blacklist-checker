# ADR 0001: Postgres provider + ORM selection, and data retention policy

- **Status**: Accepted
- **Date**: 2026-01-23
- **Owner**: Maintainer
- **Related PRD items**: P2 opt-in report saving (History/Settings)

## Context

This app performs TRON address screening via `/api/check` and `/api/analyze`. A future P2 feature will allow authenticated users to opt in to saving reports (History) and storing a `loggingEnabled` preference (Settings). To keep that implementation consistent and privacy-first, we need a single decision for:

- The Postgres provider approach (Vercel-friendly, `DATABASE_URL` compatible).
- The ORM and migration tooling.
- The data retention and privacy policy for stored reports/settings.

Non-goal: implement report saving in this ADR. This ADR defines the contract for future implementation.

## Decision

### Database provider: Postgres via `DATABASE_URL` (recommend Neon; compatible with Vercel Postgres)

We standardize on Postgres with a `DATABASE_URL` connection string.

- **Recommended provider**: Neon (serverless Postgres).
- **Also compatible**: Vercel Postgres, any managed Postgres that provides `DATABASE_URL`.

**Rationale**

- Works well with Next.js + Vercel deployments.
- Keeps infra flexible (provider swap is a config change as long as `DATABASE_URL` remains Postgres-compatible).
- Supports relational constraints + indexes needed for per-user history queries and deletion.

### ORM: Drizzle (TypeScript-first, minimal runtime)

We standardize on **Drizzle ORM** (plus `drizzle-kit` for migrations) for the report-saving data model.

**Rationale**

- Lightweight runtime (no heavy client generation step).
- Good TypeScript ergonomics; schema is code, migrations are explicit.
- Fits this codebase’s preference to keep logic in `src/lib/` and API routes thin.
- Works cleanly in **Node.js runtime** (current API routes explicitly set `export const runtime = "nodejs";`).

### Alternatives considered

#### Prisma

Pros:
- Excellent DX (schema, migrations, relations, introspection).
- Mature ecosystem.

Cons (why not chosen):
- Client generation step and heavier runtime footprint.
- Extra operational considerations in serverless environments (engines/binaries or proxy/accelerate choices).

#### SQLite / Turso

Pros:
- Simple setup.

Cons:
- Less aligned with the PRD’s Postgres assumption and future multi-tenant/history query patterns.

## Data retention & privacy policy

### Definitions

- **loggingEnabled**: user-controlled, explicit opt-in to saving data server-side. Default is **false**.
- **Saved report**: a persisted record associated to a Clerk user, derived from an `/api/analyze` result.

### What is stored when `loggingEnabled` is false

When `loggingEnabled = false`:

- **No database writes occur** (no `UserSettings`, no `SavedReport`).
- The app still returns screening results normally; data exists only in memory for the request/response cycle.
- Do not add server logs that contain raw submitted addresses.

### What is stored when `loggingEnabled` is true

When `loggingEnabled = true` (and the user is authenticated):

- Store a `UserSettings` record for the user (`loggingEnabled = true`).
- Allow “Save report” actions to create `SavedReport` records.

**Data that SHOULD be stored**

- `userId` (Clerk user id)
- `address` (the analyzed TRON address; stored only when user opted in)
- `addressHash` (keyed hash for indexing/dedup; see below)
- `riskScore`, `riskTier`, `confidence` (duplicated from `reportJson` for fast list queries)
- `reportJson` (either the `/api/analyze` response or a normalized subset)
- `createdAt`

**Data that MUST NOT be stored**

- Seed phrases, private keys, signatures.
- IP address, user-agent, or other request metadata (unless explicitly added later with a separate ADR).
- Analytics events containing raw addresses.

### Address hashing (indexing without leaking raw identifiers)

Persist an `addressHash` computed as a **keyed hash** (HMAC) so we can:

- index reports by address without exposing raw addresses in indexes/logs,
- safely deduplicate (e.g., latest report per address),
- avoid storing raw addresses when users are not opted in.

Recommended: `addressHash = HMAC_SHA256(ADDRESS_HASH_KEY, normalizedAddress)` encoded as hex/base64url.

### Retention policy

Default retention is **unlimited** (retain until the user deletes):

- Users can delete individual reports or delete all reports.
- This supports audit/history use cases.

Optional caps (operator-controlled):

- `REPORT_RETENTION_DAYS` (optional): if set, delete reports older than N days.
- `MAX_REPORTS_PER_USER` (optional): if set, enforce a maximum number of reports per user by deleting oldest first.

If caps are enabled, enforce them via a scheduled job (e.g., Vercel Cron) and/or at write time.

## Worked example: saving a report

Assumptions:

- User is authenticated in Clerk as `user_2bQm...`.
- User enabled `loggingEnabled = true` in Settings.
- User analyzes address `TVjsdY...` via `/api/analyze`.

### Example persisted records

`UserSettings`:

```json
{
  "userId": "user_2bQm...",
  "loggingEnabled": true,
  "createdAt": "2026-01-23T05:10:00.000Z",
  "updatedAt": "2026-01-23T05:10:00.000Z"
}
```

`SavedReport` (normalized example):

```json
{
  "id": "9a1f3d0e-8b7c-4a14-a2e6-9ff3d5d6c17a",
  "userId": "user_2bQm...",
  "address": "TVjsdY...",
  "addressHash": "hmacsha256:9f7b0b5b... (derived from ADDRESS_HASH_KEY + normalized address)",
  "riskScore": 72,
  "riskTier": "high",
  "confidence": 0.86,
  "window": { "lookbackDays": 30 },
  "reportJson": {
    "consensus": { "status": "not_blacklisted", "match": true },
    "risk": { "score": 72, "tier": "high", "confidence": 0.86 },
    "timestamps": { "checkedAtIso": "2026-01-23T05:10:07.123Z" },
    "checks": { "tronscan": { "ok": true, "blacklisted": false }, "onchain": { "ok": true, "blacklisted": false } }
  },
  "createdAt": "2026-01-23T05:10:08.000Z"
}
```

Notes:

- `reportJson` can be the full `/api/analyze` payload or a normalized subset; duplication of `riskScore/riskTier/confidence` supports fast “History list” queries without JSON parsing.
- If `loggingEnabled = false`, none of the above rows are created.

## Negative case: `DATABASE_URL` missing

If `DATABASE_URL` is missing:

- The app must still **build and run** screening endpoints (`/api/check`, `/api/analyze`) normally.
- All persistence features are **disabled gracefully**:
  - “Save report” UI is hidden/disabled.
  - Any API route that would write/read persisted reports returns a clear error such as `503` with `Persistence is disabled (DATABASE_URL not set).`

