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
