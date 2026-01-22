# GPT.md

This file provides guidance for Codex / GPT-based coding assistants when working in this repository.

## Project Overview
This is a Next.js (App Router) web app for TRON USDT (TRC20) wallet screening:
- **USDT blacklist check** via TronScan + on-chain contract read
- **Reputation / AML signals** (public-data first), exposed via `POST /api/analyze`
- Privacy-first defaults (no keys, no address logging by default)

The current product direction is captured in `PRD.md`.

## Non-negotiables
- Never ask for or handle seed phrases/private keys.
- Avoid logging user-submitted addresses by default (no `console.log` in API routes).
- All upstream calls must have timeouts and degrade gracefully (partial results are OK).

## Workflow rules (important)
- After every **major change** (new endpoint, new AML signal/scoring change, auth/storage/logging changes, or UI flow changes), **update `PRD.md`** to reflect:
  - what changed (scope/behavior)
  - what was completed vs pending
  - any new risks/open questions

## Commands
```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm ofac:update
```

## Testing expectations
- Keep tests **offline-first** (no network).
- Add unit tests for scoring and AML signal logic in `src/lib/*.test.ts`.
- Add route-level smoke tests (mocking upstream modules) for API response shape and gating behavior.

See `TESTs.md` for the full testing guide.

