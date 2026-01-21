# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 16 web application that checks whether TRON addresses are blacklisted for USDT (TRC20) transfers. The app verifies blacklist status using two independent methods:
1. TronScan Index API
2. Direct on-chain contract read via TronWeb/TronGrid

Privacy-focused: no seed phrases, no address logging, no analytics by default.

## Development Commands

```bash
# Install dependencies (uses pnpm)
pnpm install

# Run development server (localhost:3000)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Blockchain**: TronWeb for on-chain reads
- **Validation**: Zod schemas, custom TRON address validation (bs58 + SHA-256)
- **Animations**: Framer Motion
- **Package manager**: pnpm

### Key Files

**API Route** (`src/app/api/check/route.ts`):
- Single POST endpoint: `/api/check`
- In-memory rate limiting (30 requests/min per IP)
- Parallel validation: TronScan API + on-chain contract read
- Returns consensus status: `blacklisted`, `not_blacklisted`, or `inconclusive`
- Uses `Promise.allSettled()` to return partial results on failure

**Blockchain Integration** (`src/lib/tron.ts`):
- Creates TronWeb instances with optional `TRONGRID_API_KEY`
- Reads USDT blacklist via contract methods: `getBlackListStatus` or `isBlackListed`
- All operations have 8-second default timeouts
- Normalizes contract responses (boolean, string, number) to consistent format

**Validation** (`src/lib/validators.ts`):
- Custom TRON address validator: Base58 decode → verify 0x41 prefix → SHA-256 checksum
- Zod schemas for request validation
- Returns detailed error messages for invalid addresses

**UI Component** (`src/components/blacklist-checker.tsx`):
- Single-page app with real-time validation (300ms debounce)
- Shows consensus badge, method-specific results with evidence
- AnimatePresence for loading/error/success states
- TronScan links for addresses, contracts, transactions

### Project Structure
```
src/
├── app/
│   ├── api/check/route.ts    # API endpoint
│   ├── layout.tsx             # Root layout, metadata, theme provider
│   └── page.tsx               # Homepage (renders BlacklistChecker)
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── blacklist-checker.tsx  # Main checker UI
│   ├── copy-button.tsx
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
└── lib/
    ├── tron.ts                # TronWeb integration
    ├── validators.ts          # Address validation
    ├── i18n.ts                # UI strings
    └── utils.ts               # Tailwind merge utility
```

## Environment Variables

Optional `.env.local`:
```bash
TRONGRID_API_KEY=         # Improves TronGrid reliability (optional)
NEXT_PUBLIC_SITE_URL=     # Used for metadataBase/OG tags
```

## Security & Privacy Constraints

**Privacy Requirements** (from README):
- No address logging in API route (avoid `console.log` in `/api/check`)
- No analytics by default
- If adding analytics, hash addresses client-side before sending
- Rate limiting applied (30/min per IP, best-effort in-memory)

**Security Headers** (`next.config.ts`):
- Strict CSP, X-Frame-Options: DENY, HSTS in production
- All external calls use timeouts and return partial results on failure

## Development Notes

- **USDT Contract**: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (hardcoded in `src/lib/tron.ts`)
- **TronScan API**: Filters results by tokenName containing "USDT" or matching the contract address
- **Consensus Logic**: Only returns definitive status if both methods succeed and match
- **Error Handling**: Graceful degradation—if one verification method fails, returns partial results with notices
- **Path Aliases**: Uses `@/*` for `./src/*` (configured in `tsconfig.json`)

## Deployment

Deploy to Vercel. Set `TRONGRID_API_KEY` in project environment variables for higher reliability.
