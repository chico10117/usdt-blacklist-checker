# Progress Log
Started: Fri Jan 23 04:25:26 WET 2026

## Codebase Patterns
- (add reusable patterns here)

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
