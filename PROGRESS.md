# Sylvia — build progress

Single source of truth for where the build is. Updated after every chunk.

**Current step:** 1 Foundation
**Next action:** Step 2 Data: Cosmos containers in Bicep + `packages/core` schemas, AI Search (free tier) + `native-plants` index, CSV curation templates in `data/`.

## Build order
- [x] 1 Foundation
  - [x] Repo initialized, remote `miflowe/Sylvia`, resume docs (`CLAUDE.md`, `PROGRESS.md`, `docs/decisions.md`)
  - [x] Monorepo scaffold (pnpm workspaces, TypeScript, Vitest, ESLint)
  - [x] Design tokens → CSS variables (`packages/ui`); run `pnpm tokens` after editing `packages/ui/tokens.json`
  - [x] PWA shell + 5-tab nav (Home, Map, Sprout, Alerts, Profile). `public/icon.svg` is a placeholder until the design system has Sylvia app icons
  - [x] CI (GitHub Actions: lint, test, build)
  - [x] Bicep + azd skeleton (`infra/`, `azure.yaml`, `apps/web/Dockerfile`). NOT yet validated: needs `az bicep build` + `azd provision --preview`
  - [x] Interview kit for the team (`docs/kits/interview-kit.md`)
  - [x] First deploy (env `sylvia-dev`). Web: https://ca-web-6x6suo5lxjc5o.icysmoke-e61b83ec.canadacentral.azurecontainerapps.io · Functions: https://func-6x6suo5lxjc5o.azurewebsites.net/api/health
  - [x] Foundry: `ai-6x6suo5lxjc5o` in Sweden Central (user approved), deployments `gpt-4o` (Standard, 45K TPM; identification + explanations) and `text-embedding-3-large`. gpt-4o-mini can't be deployed (deprecated). **gpt-4o retires 2027-04-14: swap before spring rounds.**
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
- Optional: `gh auth login` (GitHub CLI isn't signed in; git push works without it).
- Register API keys: NASA FIRMS MAP_KEY, PurpleAir, Pl@ntNet. Put them in `apps/web/.env.local` (never commit).
- All 4 team members register on the Imagine Cup site; fix "five people" anywhere it appears.
- Start customer interviews with the shareable kit: https://claude.ai/artifact/VPfkfLMLKUS7j8MfftnAB7 (source `docs/kits/interview-kit.html`; share it from the page's Share menu).

## Azure for Students quirks (learned the hard way)
- Allowed regions only: canadacentral, westus2, swedencentral, norwayeast, mexicocentral.
- No Cosmos capacity in Canada Central → Cosmos is in **westus2** (user approved). Account names are per region.
- ACR remote builds blocked → web image built by `.github/workflows/web-image.yml` to `ghcr.io/miflowe/sylvia-web` (public). Deploy with `scripts/deploy-web.sh [sha]` (sets `WEB_IMAGE`, runs `azd provision`).
- Container Apps env is "express": no managed identity, and `az containerapp update` fails. Use `azd provision`.
- Functions deploy from the staged `apps/functions/deploy/` folder (pnpm symlinks can't be zipped).

## Log
- 2026-10-25: Plan approved. Repo initialized.
- 2026-10-26: Azure tools signed in. Deploy fixes (Maps region, remote build, staged Functions folder). Note: commit 0e5f187 accidentally included the hardware session's in-progress `hardware/` files (no secrets or PDFs).
- 2026-10-26: First Azure deploy live (web + Functions + Cosmos + Foundry). Interview kit published as a shareable page.
