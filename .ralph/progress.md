# Progress Log
Started: Fri Jan 23 04:25:26 WET 2026

## Codebase Patterns
- (add reusable patterns here)

---
## [2026-01-23 17:11] - US-009: [P3] Add Watchlist CRUD (UI + API) for tracked addresses
Thread:
Run: 20260123-151826-11541 (iteration 3)
Run log: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-151826-11541-iter-3.log
Run summary: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-151826-11541-iter-3.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 8d702f9 feat(watchlist): add watchlist CRUD
- Post-commit status: clean
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm test -> PASS
  - Command: pnpm build -> PASS
- Files changed:
  - src/app/api/watchlist/route.ts
  - src/app/api/watchlist/[id]/route.ts
  - src/app/(dashboard)/watchlist/page.tsx
  - src/app/(dashboard)/watchlist/watchlist-client.tsx
  - src/lib/db/user-settings.ts
  - src/lib/db/watchlist.ts
  - src/middleware.ts
  - src/__tests__/api-watchlist.test.ts
  - src/__tests__/api-watchlist-detail.test.ts
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/.tmp/prompt-20260123-151826-11541-3.md
  - .ralph/.tmp/story-20260123-151826-11541-3.json
  - .ralph/.tmp/story-20260123-151826-11541-3.md
  - .ralph/runs/run-20260123-151826-11541-iter-2.log
  - .ralph/runs/run-20260123-151826-11541-iter-2.md
  - .ralph/runs/run-20260123-151826-11541-iter-3.log
  - .ralph/progress.md
- What was implemented
  - Added `/api/watchlist` (GET/POST) and `/api/watchlist/[id]` (DELETE) scoped to the authenticated user.
  - Validated TRON address format on add and stored a per-user HMAC `addressHash` for indexing (not returned in API responses).
  - Implemented `/watchlist` UI with add form (address + optional label), list rows, and remove action; verified persistence after refresh.
  - Added route-level tests including invalid-address rejection with no DB writes.
- **Learnings for future iterations:**
  - For zsh, quote paths like `src/app/(dashboard)/...` to avoid glob expansion errors.
---
## [2026-01-23 16:36] - US-008: [P3] Add authenticated dashboard layout with sidebar navigation
Thread:
Run: 20260123-151826-11541 (iteration 2)
Run log: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-151826-11541-iter-2.log
Run summary: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-151826-11541-iter-2.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: ee1c2d5 feat(dashboard): add sidebar navigation
- Post-commit status: clean
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm test -> PASS
  - Command: pnpm build -> PASS
- Files changed:
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/overview/page.tsx
  - src/app/(dashboard)/watchlist/page.tsx
  - src/components/dashboard-sidebar.tsx
  - .agents/tasks/prd-post-mvp.json
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/.tmp/prompt-20260123-151826-11541-2.md
  - .ralph/.tmp/story-20260123-151826-11541-2.json
  - .ralph/.tmp/story-20260123-151826-11541-2.md
  - .ralph/runs/run-20260123-151826-11541-iter-1.log
  - .ralph/runs/run-20260123-151826-11541-iter-1.md
  - .ralph/runs/run-20260123-151826-11541-iter-2.log
  - .ralph/progress.md
- What was implemented
  - Added a dashboard layout with a vertical left sidebar (Overview, History, Watchlist, Settings) and active-route styling.
  - Added `/overview` and `/watchlist` pages and ensured App Router navigation keeps the shared layout without full reload.
  - Confirmed unauthenticated visits to `/overview` redirect to Clerk sign-in via existing `src/middleware.ts` protection.
- **Learnings for future iterations:**
  - Route protection is centrally handled via `src/middleware.ts` (non-public routes redirect via Clerk `redirectToSignIn()`).
  - When scripting shell reads, quote `src/app/(dashboard)` and `[[...route]]` paths to avoid zsh glob expansion.
---
## [2026-01-23 16:11:08] - US-007: [P2] Add History list + report detail + deletion (single + all)
Thread: 019beb6f-6c28-7851-bdfc-785402934107
Run: 20260123-151826-11541 (iteration 1)
Run log: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-151826-11541-iter-1.log
Run summary: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-151826-11541-iter-1.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 6730e95 feat(history): add report history and deletion
- Post-commit status: clean
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm test -> PASS
  - Command: pnpm build -> PASS
- Files changed:
  - drizzle.config.ts
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/history/page.tsx
  - src/app/(dashboard)/history/history-client.tsx
  - src/app/(dashboard)/history/[id]/page.tsx
  - src/app/(dashboard)/history/[id]/report-detail-client.tsx
  - src/app/api/saved-reports/route.ts
  - src/app/api/saved-reports/[id]/route.ts
  - src/lib/db/saved-reports.ts
  - src/lib/db/database-url.ts
  - src/lib/db/index.ts
  - src/__tests__/api-saved-reports.test.ts
  - src/__tests__/api-saved-reports-management.test.ts
  - src/__tests__/api-saved-report-detail.test.ts
  - .agents/tasks/prd-post-mvp.json
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/.tmp/prompt-20260123-151826-11541-1.md
  - .ralph/.tmp/story-20260123-151826-11541-1.json
  - .ralph/.tmp/story-20260123-151826-11541-1.md
  - .ralph/runs/run-20260123-151826-11541-iter-1.log
  - .ralph/runs/run-20260123-151826-11541-iter-1.md
  - .ralph/runs/run-20260123-135210-55147-iter-1.md
- What was implemented
  - Added `/history` with a bounded list (latest 50) of saved reports for the signed-in user.
  - Added report detail at `/history/[id]` rendering stored `reportJson`, plus evidence links extracted from the payload.
  - Added per-report delete and delete-all (with confirmation) backed by new saved report APIs, returning 404 for non-owned ids.
  - Added route-level tests for list/detail/delete and auth scoping.
- **Learnings for future iterations:**
  - Next.js App Router route params can be `Promise`-wrapped; keep route and page signatures aligned to avoid build-time type errors.
  - Avoid emitting `.env` contents into run logs; redact sensitive keys/passwords if logs are persisted.
---

## [2026-01-23 14:25:20] - US-006: [P2] Add Save Report flow (UI + API) gated by loggingEnabled
Thread:
Run: 20260123-135210-55147 (iteration 1)
Run log: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-135210-55147-iter-1.log
Run summary: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-135210-55147-iter-1.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 95fa31a feat(reports): add save report flow
- Post-commit status: clean
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm test -> PASS
  - Command: pnpm build -> PASS
- Files changed:
  - src/app/api/saved-reports/route.ts
  - src/components/blacklist-checker.tsx
  - src/__tests__/api-saved-reports.test.ts
  - src/middleware.ts
  - .ralph/runs/run-20260123-135210-55147-iter-1.log
  - .ralph/runs/run-20260123-135210-55147-iter-1.md
  - .ralph/.tmp/prompt-20260123-135210-55147-1.md
  - .ralph/.tmp/story-20260123-135210-55147-1.json
  - .ralph/.tmp/story-20260123-135210-55147-1.md
  - .ralph/activity.log
  - .ralph/progress.md
- What was implemented
  - Added `POST /api/saved-reports` to save a validated analysis report for the current user, storing `reportJson` plus summary fields (riskScore/riskTier/confidence/window).
  - Enforced that saving is allowed only when authenticated, persistence is enabled, and `loggingEnabled` is true (403 otherwise).
  - Updated the main analysis UI to show `Save this report` only when signed in and saving is enabled, with success/error toasts and a Saved state.
  - Added route-level tests covering auth/persistence/loggingEnabled gating and payload validation.
- **Learnings for future iterations:**
  - With `src/app`, the Clerk middleware must live at `src/middleware.ts` (otherwise API `auth()` can appear signed-out even when the UI shows signed in).
  - Avoid printing `.env` into run logs; this run’s log redacts Clerk keys.
---

## [2026-01-23 06:03] - US-005: [P2] Add Settings screen with privacy toggle and copy
Thread:
Run: 20260123-044356-6274 (iteration 5)
Run log: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-044356-6274-iter-5.log
Run summary: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-044356-6274-iter-5.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: cfb06ec feat(settings): add /settings privacy toggle
- Post-commit status: clean
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm test -> PASS
  - Command: pnpm build -> PASS
- Files changed:
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/settings/page.tsx
  - src/app/(dashboard)/settings/settings-client.tsx
  - src/components/blacklist-checker.tsx
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/progress.md
  - .ralph/runs/run-20260123-044356-6274-iter-5.log
  - .ralph/.tmp/prompt-20260123-044356-6274-5.md
  - .ralph/.tmp/story-20260123-044356-6274-5.json
  - .ralph/.tmp/story-20260123-044356-6274-5.md
- What was implemented
  - Added `/settings` page (dashboard layout) with a default-off toggle for `Save screening history` that reads/writes `loggingEnabled` via `/api/user-settings`.
  - Included privacy copy clarifying what is stored when enabled vs disabled, plus explicit loading/saving/success/error UI states and a negative-case error that reverts the toggle.
  - Browser-verified UI toggle behavior using dev-browser (mocked API) and captured screenshot at `/Users/chiko/.codex/skills/dev-browser/tmp/us-005-settings.png`.
- **Learnings for future iterations:**
  - For UI verification without real auth/DB, Playwright route interception can validate persistence UX (toggle + reload + failure revert) without touching the network.
---
## [2026-01-23 05:40] - US-004: [P2] Add API: user settings (loggingEnabled) with safe defaults
Thread:
Run: 20260123-044356-6274 (iteration 4)
Run log: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-044356-6274-iter-4.log
Run summary: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-044356-6274-iter-4.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 2d89d12 feat(settings): persist loggingEnabled per user
- Post-commit status: clean
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm test -> PASS
  - Command: pnpm build -> PASS
- Files changed:
  - src/app/api/user-settings/route.ts
  - middleware.ts
  - src/__tests__/api-user-settings.test.ts
  - src/components/blacklist-checker.tsx
  - .agents/tasks/prd-post-mvp.json
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/runs/run-20260123-044356-6274-iter-3.log
  - .ralph/runs/run-20260123-044356-6274-iter-3.md
  - .ralph/runs/run-20260123-044356-6274-iter-4.log
  - .ralph/.tmp/prompt-20260123-044356-6274-4.md
  - .ralph/.tmp/story-20260123-044356-6274-4.json
  - .ralph/.tmp/story-20260123-044356-6274-4.md
- What was implemented
  - Added `/api/user-settings` GET/PATCH for authenticated users to read/update `loggingEnabled` with default `false` when no row exists.
  - Ensured unauthenticated requests return 401 and do not create DB rows.
  - Added route-level tests covering default behavior and 401 unauthenticated responses.
- **Learnings for future iterations:**
  - For JSON API routes, prefer returning 401s from the handler (and allow the route through middleware) to avoid redirect responses in fetch callers.
  - Route-level behavior can be tested offline by mocking Clerk `auth()` and DB adapters.
---

## [2026-01-23 05:09] - US-002: [P2] Add DB/ORM setup, migrations workflow, and connection safety
Thread:
Run: 20260123-044356-6274 (iteration 2)
Run log: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-044356-6274-iter-2.log
Run summary: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-044356-6274-iter-2.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 6717d6f chore(db): add Drizzle ORM and migrations
- Post-commit status: clean
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm test -> PASS
  - Command: env -u DATABASE_URL pnpm build -> PASS
- Files changed:
  - drizzle.config.ts
  - package.json
  - pnpm-lock.yaml
  - vitest.config.ts
  - docs/db.md
  - src/lib/db/index.ts
  - src/lib/db/index.test.ts
  - src/lib/db/schema.ts
  - src/lib/db/migrations/0000_worthless_guardian.sql
  - src/lib/db/migrations/meta/0000_snapshot.json
  - src/lib/db/migrations/meta/_journal.json
  - src/lib/vitest-server-only.ts
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/runs/run-20260123-044356-6274-iter-1.log
  - .ralph/runs/run-20260123-044356-6274-iter-1.md
  - .ralph/runs/run-20260123-044356-6274-iter-2.log
  - .ralph/progress.md
- What was implemented
  - Added Drizzle ORM + Postgres driver setup, drizzle-kit config, and initial migrations workflow.
  - Added server-only DB client helper with safe `DATABASE_URL` gating (`getDb`/`requireDb`) and a unit test for the missing-env case.
  - Added `db:*` package scripts and documentation for local Postgres + migrations.
- **Learnings for future iterations:**
  - `server-only` needs a Vitest alias stub to avoid throwing in Node tests.
  - `uuid defaultRandom()` migrations require `pgcrypto` (`gen_random_uuid()`), so the migration includes an extension guard.
---

## [2026-01-23 04:50:18] - US-001: [P2] Decide DB + ORM and document data retention policy
Thread:
Run: 20260123-044356-6274 (iteration 1)
Run log: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-044356-6274-iter-1.log
Run summary: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-044356-6274-iter-1.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 03d6cbc docs(adr): decide DB/ORM and retention policy
- Post-commit status: clean
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm test -> PASS
  - Command: pnpm build -> PASS
- Files changed:
  - docs/adr/0001-database-orm-and-retention.md
  - .env.example
  - .ralph/progress.md
  - .ralph/activity.log
  - .ralph/runs/run-20260123-044356-6274-iter-1.log
  - .ralph/runs/run-20260123-044356-6274-iter-1.md
  - .agents/ralph/README.md
  - .agents/tasks/prd-post-mvp.json
- What was implemented
  - Added ADR selecting Postgres (Neon/Vercel Postgres compatible) and Drizzle ORM, with tradeoffs.
  - Documented retention/privacy rules and a worked example of what fields are persisted when `loggingEnabled` is enabled.
  - Documented the negative case: missing `DATABASE_URL` disables persistence gracefully while screening still works.
  - Updated `.env.example` with `DATABASE_URL`, `ADDRESS_HASH_KEY`, and optional retention/cap vars for future persistence.
- **Learnings for future iterations:**
  - `loggingEnabled` currently exists only as a client-side localStorage key; server-side persistence remains to be implemented.
  - API routes explicitly run in `nodejs`, so a Postgres + Drizzle approach should avoid Edge-only assumptions.
---

## [2026-01-23 05:24] - US-003: [P2] Implement schema: user settings + saved reports + watchlist
Thread: 019be944-302d-71d3-8a23-91587249b79d
Run: 20260123-044356-6274 (iteration 3)
Run log: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-044356-6274-iter-3.log
Run summary: /Users/chiko/side_projects/usdt_blacklisted_web/.ralph/runs/run-20260123-044356-6274-iter-3.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 6e30910 feat(db): add address hashing and scoped queries
- Post-commit status: clean
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm test -> PASS
  - Command: pnpm build -> PASS
- Files changed:
  - ralph
  - src/lib/db/index.ts
  - src/lib/db/schema.ts
  - src/lib/db/address-hash.ts
  - src/lib/db/user-settings.ts
  - src/lib/db/saved-reports.ts
  - src/lib/db/watchlist.ts
  - src/lib/db/address-hash.test.ts
  - src/lib/db/scoped-queries.test.ts
  - src/lib/db/migrations/0001_overrated_plazm.sql
  - src/lib/db/migrations/meta/0001_snapshot.json
  - src/lib/db/migrations/meta/_journal.json
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/.tmp/prompt-20260123-044356-6274-3.md
  - .ralph/.tmp/story-20260123-044356-6274-3.json
  - .ralph/.tmp/story-20260123-044356-6274-3.md
  - .ralph/runs/run-20260123-044356-6274-iter-2.md
  - .ralph/runs/run-20260123-044356-6274-iter-3.log
  - .agents/tasks/prd-post-mvp.json
- What was implemented
  - Added `ADDRESS_HASH_KEY` HMAC hashing (`addressHash`) and scoped DB query helpers that always filter by `userId`.
  - Added a `watchlist_items.user_id -> user_settings.user_id` FK (cascade delete) and migration.
  - Added unit tests covering keyed hashing and query scoping (negative-case cross-user access).
- **Learnings for future iterations:**
  - Including `userId` in the HMAC input prevents cross-user correlation even if an `addressHash` leaks.
  - Drizzle query builders can be tested offline by inspecting `.toSQL()` output (no DB required).
---
