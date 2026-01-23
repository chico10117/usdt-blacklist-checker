# Database & migrations (Postgres + Drizzle)

This repo uses **Postgres** (`DATABASE_URL`) + **Drizzle ORM** (`drizzle-orm`) with **drizzle-kit** for migrations.

## Dependencies

Installed with:

- `pnpm add -w drizzle-orm postgres server-only`
- `pnpm add -w -D drizzle-kit`

## Files

- `drizzle.config.ts`: drizzle-kit config (schema + migrations output)
- `src/lib/db/schema.ts`: Drizzle schema (tables + indexes)
- `src/lib/db/migrations/`: generated SQL migrations + journal
- `src/lib/db/index.ts`: server-only DB client helpers (`getDb`, `requireDb`)

## Common commands

- `pnpm db:generate`: generate a new migration from schema changes
- `pnpm db:migrate`: apply migrations to the database at `DATABASE_URL`
- `pnpm db:studio`: open Drizzle Studio (requires `DATABASE_URL`)

## Local Postgres example

Using Docker:

1. `docker run --name usdt_blacklisted_web-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=usdt_blacklisted_web -p 5432:5432 -d postgres:16`
2. `export DATABASE_URL=postgres://postgres:postgres@localhost:5432/usdt_blacklisted_web`
3. `pnpm db:migrate`

Cleanup:

- `docker rm -f usdt_blacklisted_web-postgres`

## Safety: missing `DATABASE_URL`

If `DATABASE_URL` is not set:

- `pnpm build` still succeeds.
- Persistence code should be gated via `getDb()` (returns `null`) or `requireDb()` (throws a clear error).

