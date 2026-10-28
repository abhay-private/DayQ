# DayLoop – Copilot instructions

DayLoop is a multi-tenant SaaS web app. Employees plan their next day, log what they actually did (start and end time per task), and management receives an automatic evening report (today's plan, actual work, tomorrow's plan). Managers assign prioritised tasks, Admins define roles and the reporting hierarchy, and a Super Admin runs the platform. The backend is API-first: the web app is the first client, Android and desktop apps come later and use the same API.

## Read first

The documents in `docs/` are the source of truth. Read the relevant ones before writing code:

- `docs/01-PRD.md`: requirements (FR-IDs), roles, permission matrix, leave, quality standards
- `docs/02-architecture.md`: components, data model (schemas, indexes), key flows, queue
- `docs/03-api-spec.md`: conventions, endpoint catalogue, error codes
- `docs/04-security.md`: Entra login, token validation, authorization, tenant isolation
- `docs/05-devops.md`: environments, Azure, pipelines, configuration
- `docs/07-implementation-roadmap.md`: the task list (when it exists)

If the code and a document disagree, or the documents are silent, stop and ask. Do not invent behaviour. Propose document changes in your answer; do not rewrite documents silently.

## Stack

- Monorepo with pnpm workspaces: `apps/api` (NestJS), `apps/web` (React), `packages/shared`, `packages/api-client`.
- Backend: Node.js LTS, TypeScript strict, NestJS, MongoDB API (Azure Cosmos DB vCore) with Mongoose, Zod schemas, Luxon for time zones, pino for logging, Jest for tests.
- Frontend: React, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query, React Router, MSAL (`@azure/msal-react`), react-hook-form with Zod, Vitest and Testing Library, Playwright for end-to-end tests.
- Azure: Container Apps (`api`, `worker`, `gotenberg`, scheduler job), Static Web Apps, Storage Queue for background jobs, Blob Storage, Key Vault, Application Insights.
- Decisions already made: background jobs use Azure Storage Queue behind a `JobQueue` interface. There is no Redis and no BullMQ in Phase 1. Login is Microsoft Entra ID only. DayLoop stores no passwords.

## Rules that are never broken

1. **Tenancy.** Every tenant document has `tenantId`. Never query or insert without it. Use the base repository, which adds it. Only the `platform-admin` module may use `PlatformRepository`.
2. **Identity comes from the token.** `tenantId` and the acting user are never read from a request body, query or path. DTOs reject unknown fields.
3. **Deny by default.** Every endpoint has `@RequirePermission(key)` (or an explicit `@Public`) and `@RequireFeature(key)`. Permission keys, scopes and feature keys come from constants in `packages/shared`, never string literals.
4. **Object-level access.** Load by id with the `tenantId` filter, then check scope with `ScopeResolver`. An object the caller may not see returns 404.
5. **Ownership rule.** Only the creator edits or deletes a plan item. The assignee may change only its status and log time against it. This lives in `PlanItemPolicy` and nowhere else.
6. **Roles are data.** Never write `if (role === 'manager')`. Check permissions and scopes.
7. **History.** Plan items, time logs, leave requests, roles and report templates keep append-only revisions through `RevisionService`. Updates need `expectedVersion` (409 on mismatch). Deletes are soft deletes.
8. **Time.** Calendar dates are `YYYY-MM-DD` text in the tenant time zone. Instants are UTC. Use Luxon and the injected `Clock`; do not call `new Date()` in business logic.
9. **Layers.** Controller (HTTP only), then service (business rules), then repository (database only). No database access in services, no business logic in controllers. Modules call each other only through service interfaces.
10. **SOLID and interfaces.** Infrastructure sits behind interfaces: `MailSender`, `WhatsAppSender`, `JobQueue`, `FileStorage`, `PdfRenderer`, `Clock`, `CacheStore`. Inject them. Never import an SDK in business code.
11. **No slow work in a request.** Email, WhatsApp, PDF and reports go through `JobQueue`. Jobs are idempotent (unique keys), may be delivered twice, and carry ids only.
12. **API-first.** Every endpoint is in the OpenAPI file through decorators, returns RFC 9457 errors with codes from `packages/shared`, and lists use cursor pagination. Any API change updates `docs/api/CHANGELOG.md`. The web app uses only the generated client.
13. **Security.** Validate all input with Zod schemas from `packages/shared`. Reject objects with `$` keys. Escape user text in reports and emails. No secrets, tokens or personal data in code, logs, queue messages or error responses. Read configuration only through the typed config module, never `process.env` elsewhere.
14. **Quality.** TypeScript strict, no `any`, no `@ts-ignore` without a written reason, no dead code, no `console.log` (use the pino logger).
15. **Test first.** Write a failing test, then the code. Test titles carry the FR-ID, for example `[FR-ASSIGN-3] employee cannot edit a manager item`.
16. **Phase 1 scope.** No billing, plan configuration UI, AI assistant, mobile or desktop app yet. Keep the hooks: `FeatureGate` always returns true in Phase 1, and every module has a feature key.

## Conventions

- Files are kebab-case, one class per file: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.policy.ts`, `*.dto.ts`, `*.schema.ts`, `*.spec.ts`.
- API paths are kebab-case plural nouns, JSON fields are camelCase, ids are strings.
- Throw domain exceptions (for example `VersionConflictError`); one global filter maps them to problem details.
- Comments explain why, not what. Public interfaces have TSDoc.
- Commits follow Conventional Commits. Branches: `feature/<ticket>-<name>`, `fix/<ticket>-<name>`.

## Performance

- Every query has an index that starts with `tenantId`. Paginate every list, project only needed fields, no N+1 queries.
- Cache only through `CacheStore` (in memory with a 60 second expiry in Phase 1).

## How to work on a task

1. Restate the task and list the FR-IDs it covers.
2. Plan: files to add or change and the tests you will write.
3. Write the failing tests first.
4. Implement the smallest change that makes them pass.
5. Run lint, type check and tests. Fix every failure.
6. Update OpenAPI, the API changelog and any affected document text (as a proposal).
7. Summarise what changed, your assumptions and open questions.

Work on one small task at a time. Do not refactor unrelated code. Ask before adding a dependency.
