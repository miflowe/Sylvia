# Sylvia — build progress

Single source of truth for where the build is. Updated after every chunk.

**Current step:** 1 Foundation
**Next action:** Scaffold the pnpm monorepo (`apps/web`, `apps/functions`, `packages/core`, `packages/ui`).

## Build order
- [ ] 1 Foundation
  - [x] Repo initialized, remote `miflowe/Sylvia`, resume docs (`CLAUDE.md`, `PROGRESS.md`, `docs/decisions.md`)
  - [ ] Monorepo scaffold (pnpm workspaces, TypeScript, Vitest, ESLint)
  - [ ] Design tokens → CSS variables (`packages/ui`)
  - [ ] PWA shell + 5-tab nav (Home, Map, Sprout, Alerts, Profile)
  - [ ] CI (GitHub Actions: lint, test, build)
  - [ ] Bicep + azd skeleton (`infra/`)
  - [ ] Interview kit for the team (`docs/kits/interview-kit.md`)
  - [ ] First deploy to Azure for Students (blocked: user installs `az`/`azd` and signs in)
  - [ ] Check Foundry model quota on the Students subscription
- [ ] 2 Data: Cosmos schema, curation templates, importers, AI Search index
- [ ] 3 Sprout pipeline + UI
- [ ] 4 Wildfire data ingestion + Home
- [ ] 5 Map
- [ ] 6 Alerts + Replay mode
- [ ] 7 Profile + Communities
- [ ] 8 Trust + polish (privacy, terms, disclaimer, a11y, tests, prod deploy)
- [ ] 9 Node design package (proposed as its own session: `hardware/PROGRESS-hardware.md`)
- [ ] 10 Pitch kit (deck, video scripts, findings template)

## Waiting on the user / team
- Install Azure CLI, Azure Developer CLI (azd) and GitHub CLI; run `az login` and `azd auth login` yourself.
- Register API keys: NASA FIRMS MAP_KEY, PurpleAir, Pl@ntNet. Put them in `apps/web/.env.local` (never commit).
- All 4 team members register on the Imagine Cup site; fix "five people" anywhere it appears.
- Start customer interviews with `docs/kits/interview-kit.md`.

## Log
- 2026-10-25: Plan approved. Repo initialized.
