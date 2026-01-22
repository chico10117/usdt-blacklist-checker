# PRD — TRON USDT Wallet Reputation & AML Screening

## Summary
Build a TRON-only, single-address screening tool that helps OTC desks, payment processors, and organizations monetizing large amounts of USDT reduce the risk of receiving “dirty” funds and having USDT frozen by Tether. The product outputs a **0–100 risk score** plus transparent findings and evidence links. No automated decisions are made; we only present findings.

## Problem
Teams that accept large USDT (TRC20) inflows can unknowingly receive funds linked to sanctions, hacks, scams, or other high-risk activity. This increases the risk of:
- **Frozen USDT** (blacklisted addresses or tainted flows)
- Operational disruption (blocked settlements, delayed payouts)
- Compliance and reputational risk

Today’s app checks whether an address is **directly blacklisted** for USDT on TRON. We need a broader “reputation + basic AML” view using **public data first**.

## Goals
- Provide a **clear risk score (0–100)** with a breakdown of contributing factors.
- Run **basic AML checks** from public sources (no paid providers initially).
- Include **volume context** (7/30/90 day USDT inflow/outflow, velocity, concentration).
- Include **medium-depth tracing** (limited hop analysis) focused on freeze risk.
- Keep **blacklist check free**, plus **one AML check free**; prompt users to create an account for additional checks.
- Add **Clerk authentication** and an **opt-in** “save results / logging” setting (privacy-first defaults).

## Non-goals (for MVP)
- Multi-chain support (TRON-only for now).
- Batch screening (single address only).
- PDF/report export (website-only output for now).
- Automated accept/reject recommendations (findings only).
- Paid AML providers (Chainalysis/TRM/Elliptic) in the first iteration.

## Target users
- OTC desks and brokers converting USDT→USD.
- Payment processors/merchants receiving large USDT payments.
- Treasury/compliance operators at crypto-native businesses.

## User experience (MVP)
### Unauthenticated (free)
- Can always run: **USDT blacklist check** (current feature).
- Can run: **one AML check** (see “Free check” below).
- Sees additional checks as locked with a clear CTA to create an account.

### Authenticated (Clerk)
- Can run the full AML suite and see the full risk score breakdown.
- Can optionally **save results** to history if the user enables logging.
- Future: credits, billing, team/workspace features.

## AML checks (public-data first)
The checks below are designed to be explainable, evidence-backed, and weighted toward “freeze risk”.

### Free check (unauthenticated)
**Sanctions screen (OFAC digital currency addresses)**:
- Match the address against a locally cached sanctions dataset (with update mechanism).
- Output: match/no match + list source + last-updated timestamp.

### Authenticated checks (MVP+)
1) **Address reputation / entity tags**
   - Pull public labels/tags where available (e.g., exchange hot wallet, service, contract).
   - Show evidence source and tag confidence (when available).

2) **USDT volume & velocity**
   - Compute inflow/outflow totals for **7/30/90 days** (or best-effort window if API limits).
   - Compute tx counts, average size, largest transfer, and “burstiness” (activity spikes).

3) **Counterparty concentration**
   - Identify top inbound counterparties by volume and their % share.
   - Flag high concentration patterns (e.g., 80%+ from one counterparty).

4) **Direct exposure (1-hop)**
   - For top N counterparties (by USDT volume), check:
     - Are they USDT-blacklisted?
     - Are they sanctioned (OFAC)?
   - Flag and quantify exposure: count + % of volume from flagged counterparties.

5) **Medium-depth tracing (limited 2-hop sampling)**
   - For a small set of highest-impact inbound counterparties, sample *their* top inbound sources.
   - Flag “2-hop proximity” to blacklisted/sanctioned addresses (best-effort; clearly labeled as partial).

6) **Flow pattern heuristics (basic)**
   - Fast-in-fast-out behavior (short time between inbound USDT and outbound USDT).
   - Peel-chain indicators (many sequential sends after a large inbound).
   - Many small inbound deposits (structuring-like patterns).

### Data completeness / confidence
Every report includes:
- Which data sources succeeded/failed
- Time window actually analyzed
- A confidence indicator used to temper the risk score

## Risk score (0–100)
### Principles
- **Explainable**: score must map to visible findings.
- **Freeze-risk weighted**: direct blacklist/sanctions/exposure dominate the score.
- **Best-effort**: partial upstream failures reduce confidence and cap how “certain” we are.

### Suggested tiers (for UI)
- 0–19: Low
- 20–39: Guarded
- 40–69: Elevated
- 70–89: High
- 90–100: Severe

### Scoring model (initial proposal)
Start with a deterministic weighted model (not ML), e.g.:
- **100** if address is USDT blacklisted (direct) OR sanctioned (direct match).
- Up to **+60** for direct (1-hop) exposure to blacklisted/sanctioned counterparties (scaled by volume share).
- Up to **+25** for suspicious flow patterns (fast-in/out, peel-chain, structuring-like).
- Up to **+15** for concentration/velocity anomalies (high concentration, high burstiness).
- ± adjustments for benign/known entities (e.g., clearly labeled major exchange), bounded and conservative.
- Apply a **confidence multiplier/cap** when data is incomplete (e.g., cannot reach sources or only partial tx history).

The API returns: `riskScore`, `riskTier`, `confidence`, and a `scoreBreakdown[]` with evidence.

## Requirements (functional)
- Single TRON address input (keep current UX baseline).
- Blacklist check remains available without auth.
- “Free AML check” available without auth (sanctions screen).
- Additional checks require Clerk login.
- Show a single unified report containing:
  - Risk score + tier + confidence
  - Findings grouped by check
  - Evidence links (TronScan tx/address pages, dataset references)
  - Clear disclaimers (“informational only; not legal advice”)

## Requirements (privacy, security, and retention)
- Default posture remains **no address logging**.
- Authenticated users can opt in to “Save reports”:
  - Settings toggle: off by default.
  - Per-check option: “Save this report” (only available if setting enabled).
  - Provide “Delete history” and per-report delete.
- Avoid storing raw addresses when not needed; prefer encryption-at-rest or keyed hashing for indexing (implementation choice).
- Keep rate limiting and timeouts; never require private keys/seed phrases.

## Data sources (public)
- **TronScan** public APIs (existing + additional endpoints for account info, token transfers, labels/tags).
- **TronGrid** (via TronWeb) for on-chain reads (existing).
- **OFAC** digital currency address dataset (ingested and cached locally with update mechanism).

## Technical approach (high-level)
### API surface
- Keep existing `POST /api/check` for blacklist.
- Add `POST /api/analyze` (or extend `/api/check` with backward-compatible fields) returning:
  - blacklist results (existing)
  - sanctions result (free)
  - gated AML checks (auth required)
  - risk score + breakdown + confidence
  - evidence links + upstream notices

### Performance constraints
- Hard timeouts per upstream call (keep 8s defaults).
- Limit tx history processing (e.g., last N USDT transfers or bounded time window).
- Add caching (in-memory + optional persistent cache) to reduce repeated upstream fetches.

### Testing & quality gates
- Maintain an offline-first test suite (no network) for scoring logic, sanctions matching, and endpoint response shapes.
- Require passing `pnpm lint`, `pnpm test`, and `pnpm build` before shipping.
- Add tests for every new AML signal:
  - unit test the signal computation (pure functions in `src/lib/*`)
  - add at least one route-level smoke test verifying response fields + gating
- Keep sanctions dataset generation (`pnpm ofac:update`) outside the test path; tests should not fetch OFAC/TronScan/TronGrid.

### Storage
- Add a DB (Postgres recommended for Vercel; provider TBD) for:
  - user settings (logging enabled/disabled)
  - optional saved reports (userId, address, results, timestamps)
  - future credits ledger

## Success criteria
Primary metric (product): **reduce freezes**.
Proxy metrics (MVP):
- % of checks that surface “severe/high” findings (blacklist/sanctions/exposure) with evidence.
- User feedback: “prevented accepting risky funds” (qualitative + simple in-app prompt).
- Low false positives for hard signals (blacklist/sanctions direct match should be near-zero FP).

## Milestones
- M0 (today): PRD written and aligned with current app.
- M1 (MVP): sanctions screen + Clerk gating + risk score v0 + volume stats v0. (Implemented in repo.)
- M2: direct exposure checks + medium-depth tracing + report saving (opt-in).
- M3: credits/billing + team/workspace + export/API access.

## Task breakdown
### P0 — Foundations (MVP)
- [x] Define API contract for `POST /api/analyze` (types, error model, evidence schema). (`src/app/api/analyze/route.ts`)
- [x] Add sanctions ingestion: OFAC dataset fetch + build-time cache + “last updated” metadata. (`scripts/fetch-ofac-tron-addresses.mjs`, `src/data/ofac-tron-addresses.json`)
- [x] Implement sanctions matcher (TRON address normalization + exact matching + source references). (`src/lib/sanctions.ts`)
- [x] Add TronScan client wrapper (timeouts, retries, schema validation, no-store cache policy). (`src/lib/tronscan.ts`)
- [x] Implement USDT transfer fetch + normalization (bounded lookback). (`src/lib/tronscan.ts`)
- [x] Compute volume stats (7/30/90d): inflow/outflow, counts, largest tx, burstiness. (`src/lib/aml.ts`)
- [x] Implement risk scoring v0 + `scoreBreakdown[]` (deterministic weights; confidence handling). (`src/lib/aml.ts`)
- [x] Integrate Clerk auth (sign in/up, session in API routes, basic protected checks). (`middleware.ts`, `src/app/layout.tsx`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`)
- [x] Update UI to show: risk score + tiers + sanctions check (free) + locked checks CTA. (`src/components/blacklist-checker.tsx`)
- [x] Update `.env.example` and README for Clerk + DB variables (keep privacy defaults explicit). (`.env.example`, `README.md`)
- [x] Add a test harness + baseline coverage for new features. (Vitest config + `TESTs.md` + unit/smoke tests)

### P1 — Exposure + medium-depth tracing
- [ ] Direct exposure (1-hop): pick top counterparties and check blacklist + sanctions.
- [ ] Add 2-hop sampled tracing for top inbound counterparties (bounded, best-effort).
- [ ] Add flow heuristics (fast-in/out, peel indicators, structuring-like).
- [ ] Add “confidence” indicator logic tied to upstream completeness and window coverage.
- [ ] Add caching layer for upstream calls and computed results (keyed by address + window).
- [ ] Add tests for each new exposure/trace heuristic (unit tests + `/api/analyze` smoke assertions).

### P2 — Opt-in report saving (privacy-first)
- [ ] Choose DB + ORM (e.g., Postgres + Prisma/Drizzle) and add migrations.
- [ ] Store user settings: `loggingEnabled` (default false).
- [ ] Add “Save this report” UX gated by settings; implement per-report retention and deletion.
- [ ] Ensure logs/analytics do not include raw addresses unless explicitly opted-in.

### P3 — Credits and packaging (future)
- [ ] Define credit model (B2C + B2B) and usage accounting.
- [ ] Add billing integration (provider TBD).
- [ ] Add team/workspace features and shared histories.
- [ ] Add export (PDF/JSON) and/or API keys for programmatic screening.

## Open questions
- What exactly counts as the “1 free AML check” long-term (sanctions only vs a limited report)? Limited report, we should cookie the user to avoid more than 1 use
- How far back should the default analysis window go for high-volume addresses (30d vs 90d vs bounded N transfers)? 90 days
- What’s the desired UX for “confidence”: a label, a % confidence, or “partial data” warnings only?
- Should we maintain our own curated “known-bad” list (hacks/scams) beyond sanctions + USDT blacklist? Yes

## Implementation notes (now completed)
- `/api/analyze` returns blacklist checks + OFAC sanctions result + risk score; volume context is currently gated behind being signed in.
- OFAC dataset updates are automated via `pnpm ofac:update`.
- Clerk UI/middleware are enabled when Clerk env keys are set; otherwise they are safely disabled so builds work without Clerk configured.
