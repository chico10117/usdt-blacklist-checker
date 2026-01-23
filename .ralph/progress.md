# Progress Log
Started: Fri Jan 23 04:25:26 WET 2026

## Codebase Patterns
- (add reusable patterns here)

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
