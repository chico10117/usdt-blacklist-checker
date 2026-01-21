## USDT (TRON) Blacklist Checker

Production-ready, mobile-first web app to check whether a public TRON address is blacklisted for **USDT (TRC20)** using two independent methods:

1) **TronScan Index API**
2) **Direct on-chain contract read** (TronWeb → TronGrid)

This app never asks for or stores seed phrases/private keys. It only needs a public address.

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

## Environment variables

Create a `.env.local` (optional):

```bash
TRONGRID_API_KEY= # optional, improves TronGrid reliability
NEXT_PUBLIC_SITE_URL=https://usdt.chikocorp.com # used for metadataBase / OG tags
```

## Privacy & security notes

- No address logging is implemented in the API route (no `console.log` / request logging in handler).
- No analytics are included. If you add analytics later, hash addresses client-side before sending.
- Rate limiting is applied to `/api/check` (best-effort in-memory, 30 requests/min per IP).
- External calls use timeouts and return partial results when possible.

## Deploy

Deploy directly to Vercel. Set `TRONGRID_API_KEY` in your Vercel project environment variables for higher reliability.

## Disclaimer

Informational only; not legal advice. Never share seed phrases or private keys.
