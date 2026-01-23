# Repository Guidelines

## Project Structure & Module Organization

- `src/app/`: Next.js App Router pages and API routes (e.g. `src/app/api/check/route.ts`, `src/app/api/analyze/route.ts`).
- `src/lib/`: Core screening logic (TRON/TronScan clients, sanctions screening, AML heuristics/scoring, validators). Unit tests are co-located as `*.test.ts`.
- `src/components/`: Reusable UI components (Tailwind CSS + shadcn/ui-style components).
- `src/data/`: Cached datasets (e.g. `src/data/ofac-tron-addresses.json`).
- `scripts/`: Maintenance scripts (e.g. OFAC dataset fetcher).
- `public/`: Static assets.

## Build, Test, and Development Commands

- `pnpm dev`: Run the local dev server at `http://localhost:3000`.
- `pnpm build` / `pnpm start`: Production build and run.
- `pnpm lint`: Run ESLint (Next.js core-web-vitals + TypeScript rules).
- `pnpm test`: Run Vitest once (Node environment).
- `pnpm test:watch`: Run tests in watch mode.
- `pnpm test:coverage`: Generate coverage output in `coverage/`.
- `pnpm ofac:update`: Refresh `src/data/ofac-tron-addresses.json` (requires network access).

## Coding Style & Naming Conventions

- Use TypeScript throughout; keep API handlers small and push logic into `src/lib/`.
- Follow existing formatting: 2-space indentation, trailing commas, and double quotes.
- Prefer the path alias `@/…` over deep relative imports.
- Naming: React components in `PascalCase`, file names in `kebab-case` (e.g. `blacklist-checker.tsx`).

## Testing Guidelines

- Framework: Vitest; tests live under `src/` and match `src/**/*.test.ts`.
- Keep tests offline-first: mock external calls (TronGrid/TronScan) and avoid real network requests.
- Add tests for new scoring/signal logic in `src/lib/*.test.ts` and route-level response-shape checks where applicable.

## Commit & Pull Request Guidelines

- Commits: keep messages short and action-oriented (examples from history: “Add …”, “Implement …”, “Improve …”). Add a scope prefix when helpful (e.g. `api:`, `ui:`).
- PRs: include a clear description of behavior changes, link any relevant issues/notes (see `PRD.md`), and add screenshots for UI changes. Run `pnpm lint` and `pnpm test` before requesting review.

## Security & Configuration Tips

- Use `.env.local` for secrets; reference `.env.example` for required keys.
- Never request, store, or log seed phrases/private keys.
- Avoid logging user-submitted addresses in API routes, and do not send raw addresses to analytics.
