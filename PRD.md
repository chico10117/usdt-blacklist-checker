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
- After sign-in, automatically re-runs analysis for the currently entered address to immediately reveal unlocked checks.
- Shows an account-level privacy toggle for “save screening history” (initially stored as a local preference; server-side history comes later with DB/credits).
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

### Flow heuristics — implemented details (P1)
These heuristics are **best-effort**, computed only from the available TRON USDT (TRC20) transfer history window, and are intended to surface patterns that often correlate with higher freeze/taint risk.

**Important caveats**
- These signals are *not proof of wrongdoing*. Many legitimate entities (exchanges, payment processors, aggregation wallets, sweepers) can resemble these patterns.
- We are only looking at **USDT (TRC20)** transfers and only within the **bounded lookback** (currently 90d best-effort, with pagination limits).
- These checks are currently **auth-gated** in the product UI/API (P1), but the heuristics themselves are deterministic and offline-testable.

#### 1) Fast-in / fast-out (high-velocity pass-through)
**Goal**: detect rapid turnover where a large inbound is followed by rapid outbound that “empties” most of that inbound.

**Definition (current implementation)**
- Consider an **inbound** USDT transfer `inTx` to the subject wallet.
- Only evaluate if `inTx.amount >= 1,000 USDT`.
- Look at **all outbound** USDT transfers from the subject wallet in the next **120 minutes**.
- If the outbound sum within that window is **≥ 80%** of the inbound amount, emit a finding:
  - Severity: `danger` if ≥ 95%, else `warning`.

**Why it matters**
- Rapid pass-through behavior can indicate broker-style forwarding, laundering hops, or “bridge/swap then forward” activity. It’s a common “high-velocity” trait in tainted flow cases.

**Example**
- Wallet receives **2,500 USDT** at 10:00.
- Wallet sends **1,200 USDT** at 10:25 and **900 USDT** at 10:55.
- Outflow within 120m = **2,100 / 2,500 = 84%** → triggers *fast-in/fast-out*.

#### 2) Structuring-like inbound deposits (many small deposits)
**Goal**: detect many small deposits in a short period (a pattern sometimes associated with “structuring” behavior).

**Definition (current implementation)**
- Consider inbound USDT transfers **≤ 100 USDT**.
- Sliding window of **24 hours**.
- Trigger if, within any 24h window:
  - `count >= 20` AND
  - `sum >= 1,000 USDT`
- Severity: `danger` if `count >= 40`, else `warning`.

**Why it matters**
- Large numbers of small deposits can be consistent with distribution from many sources, “deposit splitting”, or aggregation flows. It’s not conclusive, but it’s a useful anomaly signal.

**Example**
- In a 24h period, wallet receives **30 inbound transfers** of **50 USDT** each.
- Count = 30 (≥20), sum = 1,500 USDT (≥1,000) → triggers *structuring-like*.

#### 3) Peel-chain-like outflow burst
**Goal**: detect a “large inbound then many outbound sends” pattern consistent with peeling value across many outputs.

**Definition (current implementation)**
- Consider an inbound transfer `inTx` only if `inTx.amount >= 10,000 USDT`.
- Look at outbound transfers within the next **6 hours**.
- Trigger if outbound transfer **count >= 10** within that window.
- Severity: `danger` if `count >= 20`, else `warning`.

**Why it matters**
- Peel-chain-like behavior is a known tactic to disperse value across many hops/addresses, increasing trace complexity.

**Example**
- Wallet receives **50,000 USDT** at 09:00.
- Between 09:10–13:00 it sends **12 outbound transfers** to different addresses.
- Count = 12 (≥10) → triggers *peel-like outflow burst*.

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
- Apply a **confidence** model when data is incomplete (e.g., cannot reach sources or only partial tx history). The current implementation returns confidence as a **0–100** quality indicator for the score; it does not currently scale the score itself.

The API returns: `riskScore`, `riskTier`, `confidence`, and a `scoreBreakdown[]` with evidence.

### Scoring model — current implementation (v1)
This section documents the **current** deterministic model used by the API (so results are explainable and testable).

#### Hard stops (100 = Severe)
- **100** if OFAC sanctions direct match.
- **100** if USDT blacklist **consensus** is `blacklisted`.
- **95** (Severe) if any blacklist method indicates blacklisted but overall consensus is `inconclusive`.

#### Baseline
- Start at **5** (“Baseline risk”).

#### Volume (auth-gated; if available)
Based on 90-day inbound volume and total 90-day tx count:
- Inbound (90d): +3 / +5 / +8 at **≥ 100 / 1,000 / 10,000 USDT**.
- Activity (90d): +1 / +3 / +5 at **≥ 100 / 500 / 2,000 transfers** (inbound+outbound).

#### Direct exposure (1-hop, inbound; computed from transfer history)
Computed over the observed 90-day window:
- +20 (or +30 if flagged inbound share ≥ 10%) if any top inbound counterparty is OFAC-sanctioned.
- +25 if any top inbound counterparty is USDT-blacklisted.
- +8 if inbound is **highly concentrated** (top counterparty share ≥ 80%) *and* there is enough activity to be meaningful (≥ 20 inbound tx OR ≥ 1,000 USDT inbound total).

#### 2-hop sampled tracing (auth-gated; if available)
- +10 if any 2-hop sampled upstream source is flagged (OFAC or USDT blacklist).

#### Flow heuristics (auth-gated; if available)
- +15 if fast-in/fast-out is detected.
- +10 if peel-like outflow burst is detected.
- +8 if structuring-like inbound deposits is detected.

#### Confidence (0–100)
Confidence is a **quality/completeness indicator** for the computed score:
- Starts at 100 and is reduced for upstream failures, locked checks, and partial signals (like pagination-limited transfer history).
- The score is still reported normally, but consumers should treat a low confidence as “we might be missing risk signals”.

### Score examples (illustrative)
These examples assume the address is **not** directly sanctioned/blacklisted.

#### Example A — Low (≈ 5/100)
- Wallet has no sanctions match and is not blacklisted.
- No transfer history is available (or very little activity); no exposure or heuristic signals are detected.
- Expected breakdown: `Baseline risk (+5)` → **Score ≈ 5**, **Tier: Low**.

#### Example B — Guarded / Elevated (≈ 20–40/100)
- Wallet is clean on sanctions/blacklist.
- Has meaningful volume (e.g., ≥ 1,000 USDT inbound over 90d) and higher activity.
- No direct exposure and no heuristic signals.
- Expected breakdown: `Baseline (+5)` + `Volume (+5..+13)` → typically **~10–20**; if very active, can reach **Guarded/Elevated**.

#### Example C — High (≈ 60–85/100)
- Wallet is clean on direct sanctions/blacklist.
- One of the top inbound counterparties is USDT-blacklisted (+25) OR sanctioned (+20/+30).
- May also be highly concentrated (+8) and/or have suspicious flow heuristics (+8..+15).
- Example breakdown: `Baseline (+5)` + `Exposure blacklist (+25)` + `Fast in/out (+15)` + `2-hop proximity (+10)` → **Score ≈ 55** (Elevated) to **~80** (High) depending on additional signals.

#### Example D — Severe (≈ 95–100/100)
- Direct sanctions match → **100**.
- Direct blacklist consensus blacklisted → **100**.
- Inconclusive blacklist consensus but at least one method says blacklisted → **95**.

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
- [x] Direct exposure (1-hop): pick top counterparties and check blacklist + sanctions.
- [x] Add 2-hop sampled tracing for top inbound counterparties (bounded, best-effort).
- [x] Add flow heuristics (fast-in/out, peel indicators, structuring-like).
- [x] Add “confidence” indicator logic tied to upstream completeness and window coverage.
- [x] Add caching layer for upstream calls and computed results (keyed by address + window).
- [x] Add tests for each new exposure/trace heuristic (unit tests + `/api/analyze` smoke assertions).

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
- What’s the desired UX for “confidence”: a label, a % confidence, or “partial data” warnings only? **% confidence (0–100)** for the current score.
- Should we maintain our own curated “known-bad” list (hacks/scams) beyond sanctions + USDT blacklist? Yes

## Implementation notes (now completed)
- `/api/analyze` returns blacklist checks + OFAC sanctions result + risk score; volume context is currently gated behind being signed in.
- `/api/analyze` now includes P1 checks:
  - Direct exposure (1-hop, inbound) for all users (top 10 inbound counterparties over 90d).
  - 2-hop sampled tracing + flow heuristics gated behind auth.
  - Risk score includes exposure + heuristics signals when available.
  - Confidence is returned as **0–100** and reflects missing/locked/partial inputs.
- Added an in-memory TTL cache (hashed keys) for TronScan calls and computed `/api/analyze` results (best-effort UX + rate control).
- OFAC dataset updates are automated via `pnpm ofac:update`.
- Clerk UI/middleware are enabled when Clerk env keys are set; otherwise they are safely disabled so builds work without Clerk configured.
