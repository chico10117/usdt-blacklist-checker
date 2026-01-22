## USDT (TRON) Blacklist Checker

Production-ready, mobile-first web app to check whether a public TRON address is blacklisted for **USDT (TRC20)** using two independent methods:

1) **TronScan Index API**
2) **Direct on-chain contract read** (TronWeb → TronGrid)

This app never asks for or stores seed phrases/private keys. It only needs a public address.

It also includes an initial **sanctions screen (OFAC, TRON addresses)** and a new analysis endpoint (`/api/analyze`) that returns a **0–100 risk score**. Additional AML checks (like volume context) are gated behind authentication (Clerk).

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## API

- `POST /api/check`
  - Body: `{ "address": "T..." }`
  - Returns combined results, evidence (when available), consensus, and notices.
- `POST /api/analyze`
  - Body: `{ "address": "T..." }`
  - Returns blacklist results + OFAC sanctions screen (free) and a risk score. Some AML checks are available only when signed in.

## Environment variables

Create a `.env.local` (optional):

```bash
TRONGRID_API_KEY= # optional, improves TronGrid reliability
NEXT_PUBLIC_SITE_URL=https://usdt.chikocorp.com # used for metadataBase / OG tags

# Clerk (required to enable sign-in)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

## OFAC dataset updates

The sanctions matcher uses a locally cached dataset at `src/data/ofac-tron-addresses.json`.

Update it:

```bash
pnpm ofac:update
```

## Privacy & security notes

- No address logging is implemented in the API route (no `console.log` / request logging in handler).
- Vercel Analytics can be enabled/disabled independently; do not send raw addresses to analytics.
- Rate limiting is applied to `/api/check` (best-effort in-memory, 30 requests/min per IP).
- External calls use timeouts and return partial results when possible.

## Deploy

Deploy directly to Vercel. Set `TRONGRID_API_KEY` in your Vercel project environment variables for higher reliability.

## Disclaimer

Informational only; not legal advice. Never share seed phrases or private keys.
