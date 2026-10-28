# AGENTS.md

Instructions for coding agents (GitHub Copilot agent mode and the Copilot coding agent) working in the DayLoop repository. The project rules are in `.github/copilot-instructions.md`; the full requirements are in `docs/`. Read both before you start.

## Project in one paragraph

DayLoop is a multi-tenant SaaS app for daily planning, time-wise work logs and automatic evening reports. NestJS API (API-first, OpenAPI), React web app, a worker that reads an Azure Storage Queue, MongoDB API on Cosmos DB vCore, Microsoft Entra ID login, deployed as containers on Azure.

## Setup and commands

These scripts are created in Phase 0. Use these exact names.

```
pnpm install              install all workspaces
docker compose up -d      local MongoDB, Azurite (queue emulator), mail catcher, Gotenberg, mock OIDC issuer
pnpm dev                  run API, worker and web locally
pnpm lint                 ESLint and Prettier check
pnpm typecheck            TypeScript check for every workspace
pnpm test                 unit tests
pnpm test:int             integration tests (real MongoDB and Azurite in containers)
pnpm test:e2e             Playwright end-to-end tests against the local stack
pnpm openapi:generate     regenerate docs/api/openapi.yaml and the TypeScript client
pnpm migrate              run database migrations
```

## Definition of done

A task is done only when all of this is true:

- [ ] Lint, type check, unit and integration tests pass locally.
- [ ] New or changed behaviour has tests, including a denied-access test, an other-company test and, for plan items, an ownership test.
- [ ] Every new endpoint has a permission key, scope, feature key, schemas, error codes and an example in OpenAPI, and `docs/api/CHANGELOG.md` is updated.
- [ ] Every query includes `tenantId`; every by-id access checks scope.
- [ ] No secrets, tokens or personal data in code, logs, queue messages or error responses.
- [ ] Migrations follow expand-then-contract and have a test.
- [ ] The security checklist in `docs/04-security.md` section 17 is satisfied.
- [ ] The summary lists assumptions and open questions.

## Boundaries

**Always**
- Follow the documents in `docs/`; ask when they are silent or contradict the code.
- Write the test first and keep changes small and focused.
- Use the interfaces (`MailSender`, `JobQueue`, `Clock`, and so on) instead of SDKs in business code.

**Ask first**
- Adding a dependency.
- Changing a schema, an index, a permission key or a scope.
- Any breaking API change.
- Anything in auth, permissions, tenant context, `infra/` or `.github/workflows/` (these paths have code owners).
- Deleting files or large refactors.

**Never**
- Commit secrets, `.env` files or real customer data.
- Disable or skip tests, lint, type checks or security scans to make a build pass.
- Bypass the tenant filter or hardcode a role name.
- Edit generated files by hand (`docs/api/openapi.yaml`, `packages/api-client`).
- Call real external services (Microsoft, email, WhatsApp) from tests.
- Enable test tools in Production configuration.
- Introduce Redis or BullMQ (Phase 1 uses Azure Storage Queue behind `JobQueue`).

## Working from the roadmap

Tasks in `docs/07-implementation-roadmap.md` have ids like `M2-T05`. Do one task per pull request. Name the branch `feature/<task-id>-<short-name>`, reference the task id and FR-IDs in the pull request, and use the pull request template.
