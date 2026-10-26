# Sylvia — notes for Claude

Wildfire-resilience PWA for Microsoft Imagine Cup 2027 (Launch path, Health & Life Sciences). Pilots: Ontario + BC.

## Start every session here
1. Read `PROGRESS.md`: current step, exact next action, blockers.
2. `git log --oneline -15`, then run `pnpm test` to confirm the tree is green.
3. Continue from "Next action". Never redo finished steps; never guess at decisions.

Product decisions live in `docs/decisions.md` (the approved plan). Don't change them without the user.

## Working rules
- Work in small chunks (~30–45 min). Finish the chunk, run its tests, commit, push, update `PROGRESS.md`.
- The repo `miflowe/Sylvia` is PUBLIC: no secrets, keys or copyrighted PDFs. Secrets go in `.env.local`
  (gitignored), GitHub Actions secrets or Key Vault.
- `resources weve gathered/` is private team material: gitignored, never commit it.
- Long commands run in the background and log to `logs/`.

## Layout
- `apps/web`: Next.js PWA (App Router, TypeScript)
- `apps/functions`: Azure Functions (TypeScript): data ingestion, alerts, push
- `packages/core`: shared types, verdict logic, alert rules, copy/voice
- `packages/ui`: design tokens → CSS variables, shared components
- `data/`: curation templates + importers · `infra/`: Bicep + azd · `hardware/`: Node design · `docs/`: decisions, kits, policies

## Voice
Sylvia speaks in first person in Sprout, tips and explanations. Alerts are impersonal and instruction-first.
Level 1–2 alerts are labelled "unverified" with source + time. Level 3 only relays official orders and names the
agency. Never give evacuation routes. Never call a plant fireproof. Canadian spelling. Show source + timestamp on
every reading.

## Commands
- `pnpm install` · `pnpm dev` (web) · `pnpm test` · `pnpm build` · `pnpm lint`
