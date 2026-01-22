# Testing guide

This repo uses **Vitest** for fast, offline-friendly tests. The goal is to make it safe to add new AML features (signals, scoring, tracing) without regressions.

## Quick start

```bash
pnpm test
```

Useful variants:

```bash
pnpm test:watch
pnpm test:coverage
```

## What’s covered today

### Unit tests (pure logic)
- `src/lib/aml.test.ts`: volume windows + scoring behavior.
- `src/lib/sanctions.test.ts`: OFAC matcher behavior.

### API route smoke tests (no network)
- `src/__tests__/api-analyze.test.ts`: verifies `/api/analyze` response shape, free vs gated behavior, and that upstream calls are mocked.

## Principles for adding future tests

### 1) Keep tests offline (no network)
Anything that calls upstreams (TronScan/TronGrid/OFAC fetches) should be tested via mocks:
- Prefer `vi.mock()` for module-level dependencies.
- Avoid calling real `fetch()` from tests.

### 2) Test “signals” independently from the API route
For new AML features, add a small function in `src/lib/*` and test it directly:
- Input: normalized transfers / labels / exposures
- Output: deterministic flags + evidence + points contribution

This makes it much easier to evolve the scoring model without breaking the API surface.

### 3) Add at least one route-level smoke test per endpoint
When adding a new endpoint or changing response shapes:
- Mock upstream modules.
- Call the route handler with a real `Request`.
- Assert the presence of new fields and the gating behavior.

## Updating the OFAC TRON address cache

The sanctions matcher uses a generated dataset at `src/data/ofac-tron-addresses.json`.

Update it:

```bash
pnpm ofac:update
```

Note: this script uses the network; tests do not.

## Manual sanity checks (optional)

Run the dev server:

```bash
pnpm dev
```

Then:
- Check an address on the homepage: verifies UI + `/api/analyze`.
- Call the APIs directly:
  - `curl -sS -X POST http://localhost:3000/api/check -H 'content-type: application/json' -H 'user-agent: curl' -d '{"address":"T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"}' | jq`
  - `curl -sS -X POST http://localhost:3000/api/analyze -H 'content-type: application/json' -H 'user-agent: curl' -d '{"address":"T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"}' | jq`

To test gated checks, configure Clerk keys in `.env.local` (see `.env.example`) and sign in.

