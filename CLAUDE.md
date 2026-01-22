# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 16 web application that checks whether TRON addresses are blacklisted for USDT (TRC20) transfers. The app verifies blacklist status using two independent methods:
1. TronScan Index API
2. Direct on-chain contract read via TronWeb/TronGrid

Also includes OFAC sanctions screening and a risk scoring system. Authentication via Clerk gates advanced AML features (volume analysis).

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Run dev server (localhost:3000)
pnpm build            # Build for production
pnpm lint             # Run ESLint

# Testing (Vitest)
pnpm test             # Run all tests once
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage report

# Data updates
pnpm ofac:update      # Refresh OFAC TRON addresses dataset
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Auth**: Clerk (optional, gates volume analysis features)
- **Blockchain**: TronWeb for on-chain reads
- **Testing**: Vitest
- **Package manager**: pnpm

### API Endpoints

**`POST /api/check`** — Basic blacklist check
- Parallel validation: TronScan API + on-chain contract read
- Returns consensus: `blacklisted`, `not_blacklisted`, or `inconclusive`

**`POST /api/analyze`** — Full risk analysis (Clerk auth optional)
- Blacklist checks (same as `/check`)
- OFAC sanctions screening (free)
- Volume analysis: 7/30/90-day USDT transfer stats (requires auth)
- Returns 0–100 risk score with tier (`low`/`guarded`/`elevated`/`high`/`severe`)

### Key Modules

**`src/lib/tron.ts`** — TronWeb/TronGrid integration
- Reads USDT blacklist via `getBlackListStatus` or `isBlackListed` contract methods
- 8-second default timeouts

**`src/lib/tronscan.ts`** — TronScan API client
- `checkTronScanUsdtBlacklist()` — blacklist status via index API
- `fetchUsdtTrc20Transfers()` — paginated transfer history for volume stats

**`src/lib/sanctions.ts`** — OFAC screening
- Uses cached dataset at `src/data/ofac-tron-addresses.json`
- Update with `pnpm ofac:update`

**`src/lib/aml.ts`** — Risk scoring
- `computeUsdtVolumeStats()` — 7/30/90d inbound/outbound volume
- `computeRiskScore()` — weighted score from blacklist, sanctions, volume signals

**`src/lib/validators.ts`** — TRON address validation
- Base58 decode → 0x41 prefix check → SHA-256 checksum verification

## Environment Variables

```bash
# Optional - improves TronGrid reliability
TRONGRID_API_KEY=

# Site URL for OG tags
NEXT_PUBLIC_SITE_URL=https://usdt.chikocorp.com

# Clerk auth (required to enable sign-in and volume analysis)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

## Privacy & Security

- **No address logging** — avoid `console.log` with addresses in API routes
- **No analytics by default** — if adding, hash addresses client-side first
- **Rate limiting** — 30 requests/min per IP (in-memory)
- **Security headers** — strict CSP, HSTS, X-Frame-Options: DENY

## Development Notes

- **USDT Contract**: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- **Consensus Logic**: Only definitive if both methods succeed and agree
- **Path Aliases**: `@/*` → `./src/*`
- **Test files**: `src/**/*.test.ts` (Vitest with Node environment)
