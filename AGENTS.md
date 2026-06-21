# AGENTS.md

## Purpose

This repository is a monorepo for `gestao_financeira`, a shared financial control app with offline-first web behavior, event-based sync, Prisma-backed persistence, and Docker/EasyPanel deployment.

Use this file as the default operating guide for future work in the repo.

## Tech Stack

- `apps/web`: Next.js 14 App Router, React 18, Tailwind, shadcn/ui, Dexie, TanStack Query, Playwright, Vitest
- `apps/api`: NestJS, Prisma, PostgreSQL, JWT auth, refresh tokens, rate limiting, Vitest
- `packages/shared`: shared DTOs, schemas, enums, date helpers, debt installment logic, recurring logic
- Infra: Docker, docker-compose, GitHub Actions, GHCR, EasyPanel, optional Caddy proxy

## Non-Negotiables

- Keep the monorepo structure intact.
- Prefer shared logic in `packages/shared` when a rule, schema, or helper is used by both web and API.
- Never edit generated output folders by hand: `node_modules`, `.next`, `dist`, `test-results`, `*.tsbuildinfo`, Prisma client output, or build artifacts.
- Never lower coverage thresholds or delete tests just to make the suite pass.
- Never weaken auth, CORS, validation, or deployment rules without a clear reason.
- Preserve the offline-first model and sync semantics unless the task explicitly changes them.
- Keep browser requests on the web domain whenever possible; the web app should proxy `/api` to the backend in deployed environments.
- Treat the workspace as possibly dirty. Do not overwrite unrelated user changes.

## Repo Map

- `apps/web/src/app`: pages, layouts, API proxy route, app shell, login, wallets, transactions, debts, reports, users
- `apps/web/src/components`: reusable UI and feature components
- `apps/web/src/lib`: auth, runtime config, sync, theme, storage, API helpers, date and domain utilities
- `apps/web/public`: PWA assets, icons, manifest, service worker, offline page
- `apps/api/src`: controllers, services, guards, decorators, DTOs, auth, sync, debts, wallets, categories, Prisma
- `apps/api/prisma`: schema and migrations
- `packages/shared/src`: DTOs, enums, schemas, recurring logic, installment logic, datetime helpers
- `scripts`: e2e stack bootstrap and seed scripts
- `tests/e2e`: browser end-to-end tests
- `deploy/easypanel`: deployment guide for image-based hosting
- `.github/workflows`: release and image publishing automation

## Source Of Truth Rules

- If a rule affects both frontend and backend, define the canonical shape in `packages/shared` first.
- If a route, DTO, schema, or enum changes, update all consumers in the same change set.
- If a deployment variable changes, update `.env.example`, deployment docs, and the relevant Dockerfile or compose file.
- If a business rule changes, update tests in the smallest scope that proves the new behavior.
- If behavior is reused by multiple workspaces, prefer a shared helper over copy/paste.

## Code Style

- Use TypeScript everywhere unless a file is already intentionally JavaScript or CommonJS.
- Match existing naming and folder patterns rather than introducing new conventions.
- Keep UI text in Portuguese for user-facing screens unless the surrounding screen is already English.
- Use the existing design system and Lucide icons before adding new visual primitives.
- Keep components focused and composable. Avoid large monolithic components when the feature can be split cleanly.
- Prefer explicit, readable code over clever abstractions.
- Add short comments only when the code would otherwise be hard to understand.

## Change Workflow

1. Inspect the smallest set of files needed to understand the change.
2. Identify whether the change belongs in web, API, shared, or deployment layers.
3. Update shared code first when the change crosses boundaries.
4. Apply the implementation in the owning workspace.
5. Update or add tests close to the affected behavior.
6. Run the narrowest useful validation first, then expand if the change is cross-cutting.
7. If the change affects deployment, verify the Docker and EasyPanel assumptions before finishing.

## Validation Strategy

Use the scripts already defined in the root `package.json`.

### Basic checks

```bash
npm install
npm run lint
npm run build
```

### Workspace tests

```bash
npm run test:shared
npm run test:web
npm run test:api
npm run test:unit
npm run test:integration
npm run test
```

### Coverage

```bash
npm run test:coverage
```

### End-to-end

```bash
npm run test:e2e:install
npm run test:e2e:serve
npm run test:e2e:seed
npm run test:e2e
npm run test:all
```

## Test Expectations

- `packages/shared` tests run in Node and should focus on pure logic.
- `apps/api` tests run in Node and should cover services, guards, controllers, DTO behavior, and auth logic.
- `apps/web` tests run in `jsdom` and should cover UI state, client logic, and browser behavior.
- Playwright tests cover the real browser flow and should be used for login, auth, sync, or deployment-sensitive flows.
- E2E full-stack validation requires Docker Desktop running locally.
- Use existing test setup files and mocks before creating new testing infrastructure.
- Add tests for login, auth, wallet access, debt/installment logic, recurring logic, sync behavior, and any data-shaping change.

## Workspace-Specific Guidance

### `packages/shared`

- Keep pure domain logic here.
- Favor deterministic helpers and schema validation.
- Maintain compatibility between web and API consumers.
- Do not introduce browser or server framework dependencies here.

### `apps/api`

- Treat Prisma schema and migrations as the source of truth for persistence.
- Regenerate Prisma client when schema changes require it.
- Keep guards, decorators, DTOs, and services aligned.
- Preserve auth contracts, token handling, throttling, and health checks.
- If a change affects login or session refresh, verify the HTTP response codes and cookie/token behavior.

### `apps/web`

- Keep client runtime logic in `src/lib`.
- Keep feature UI in `src/components`.
- Keep route pages thin and move reusable logic out of page files where practical.
- Preserve the same-origin `/api` proxy pattern for production browser requests.
- When changing forms, keep labels, validation, disabled states, and error feedback visible and accessible.
- Prefer existing icons and controls over custom ad hoc UI.

## Deployment Rules

- Local Docker is supported through `docker compose`.
- EasyPanel deployment uses separate app services for API and web plus a managed Postgres service.
- The web container should receive `API_PUBLIC_URL` at runtime so the backend URL can be changed without rebuilding the image.
- The API container should expose `/health` and use a strong `DATABASE_URL`.
- The GitHub Actions workflow publishes Docker images from `main` and tags.
- Keep `README.md`, `.env.example`, and `deploy/easypanel/README.md` in sync with deployment behavior.

## Environment Variables

### API

- Required: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
- Common: `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `ADMIN_EMAIL`, `PORT`

### Web

- Build-time or local default: `NEXT_PUBLIC_API_URL`
- Runtime proxy target: `API_PUBLIC_URL`
- Common: `NEXT_PUBLIC_ADMIN_EMAIL`, `PORT`, `HOSTNAME`

### Local and Docker

- Keep `.env.example` up to date when adding or renaming variables.
- Prefer runtime configuration for values that may differ between environments.
- Do not hardcode secrets in source files.

## Docker And Compose

- `apps/api/Dockerfile` builds shared code, generates Prisma, builds the API, and runs migrations on startup.
- `apps/web/Dockerfile` builds shared code and the Next app, then runs the standalone server.
- `docker-compose.yml` is the canonical service definition.
- `docker-compose.local.yml` only adds host port mappings.
- `docker-compose.e2e.yml` is reserved for e2e stack behavior.

## Git And PR Practices

- Use branches and pull requests intentionally. Do not push directly to `main` unless the user explicitly asks.
- Do not force-push or rewrite shared history unless requested.
- If a PR already exists, update that PR instead of opening duplicate work.
- If conflicts appear, resolve the exact conflicting lines and preserve unrelated user changes.
- Summarize the impact of a change clearly in PR descriptions and handoff notes.

## Known Repository Gotchas

- The repo uses npm workspaces. Do not switch package managers casually.
- Next.js workspace builds can hit lockfile/SWC patching problems in npm workspace environments. If that happens in Docker builds, check the `NEXT_IGNORE_INCORRECT_LOCKFILE` workaround instead of randomly changing dependency versions.
- Browser login issues should be checked in the network tab first, then server logs, then proxy/runtime config.
- If logs appear blank in a hosted panel, confirm the process is actually running, the service has health checks, and the container command matches the expected startup path.

## Things To Avoid

- Do not edit `package-lock.json` manually.
- Do not edit build artifacts or generated client output by hand.
- Do not introduce a second testing stack when Vitest/Playwright already cover the repo.
- Do not create new deployment instructions in only one place.
- Do not remove existing validation just because a test is slow or inconvenient.

## Completion Standard

Before finishing any meaningful change, confirm:

- the affected code path is updated in the right workspace
- tests were added or updated where behavior changed
- the relevant build or test command was run, or the reason it was not run is recorded
- docs or deployment notes were updated if the change affects operators or runtime config
