---
applyTo: "apps/api/**"
---
# Backend rules (NestJS API and worker)

Follow `docs/02-architecture.md` (sections 3 to 7), `docs/03-api-spec.md` and `docs/04-security.md`.

## Module layout

Each domain is a Nest module under `apps/api/src/modules/<name>/` with: `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts`, `<name>.policy.ts` (only when rules need it), `dto/`, `schemas/`, `*.spec.ts`. Modules: auth, tenants, users, roles, hierarchy, plan-items, time-logs, leave, holidays, reports, notifications, audit, entitlements, platform-admin.

- A module owns its collections. Other modules use its service interface, never its repository or collection.
- Infrastructure (mail, WhatsApp, storage, PDF, queue, clock, cache) lives in `src/infrastructure/` behind interfaces and is injected.
- The API (`main.ts`), the worker (`worker.ts`) and the scheduler (`scheduler.ts`) are three entrypoints of the same codebase.

## Controllers

- HTTP only: parse and validate input, call one service method, return the result. No business rules, no database access.
- Every route: `@RequirePermission('<key>', ...)` or `@Public()`, `@RequireFeature('<key>')`, OpenAPI decorators (summary, description, permission, feature, request and response schemas, error codes, example).
- Request bodies are DTOs built from Zod schemas in `packages/shared`. Unknown fields are rejected. `tenantId`, the acting user, `createdBy`, `version` and server-owned status fields are never accepted from input.
- Create routes support `Idempotency-Key`. Lists use cursor pagination (`limit` up to 100, `cursor`) and return `{ items, nextCursor }`.

## Services

- Hold business rules and orchestration. Get the acting context from `RequestContext` (tenantId, userId, effective permissions), never from parameters supplied by the client.
- Check scope with `ScopeResolver` for every target user. Check ownership with the module's policy class.
- Updates: compare `expectedVersion`, increment `version`, append a revision through `RevisionService` (same transaction when supported, otherwise revision first with the unique `entityId + version` index).
- Throw domain exceptions with stable codes from `packages/shared` (for example `VersionConflictError`, `OwnershipViolationError`, `HierarchyCycleError`). Never throw raw strings or return error objects.
- Time: use the injected `Clock` and Luxon with the tenant time zone. Calendar dates are `YYYY-MM-DD` text, instants are UTC.
- Day status (holiday, weekly off, approved leave, working) comes only from `DayStatusService`.
- Slow or external work (email, WhatsApp, PDF, report generation) is queued through `JobQueue`. Never `await` a mail provider inside a request.

## Repositories

- Extend the base repository so `tenantId` is added to every query and insert. Never build queries from raw request objects. Reject values that are objects where a string or number is expected.
- Use `lean()` reads, field projections and pagination. No N+1 queries: batch by ids.
- Indexes start with `tenantId` and are created by migrations, not at application start.

## Jobs and worker

- Handlers are idempotent. The queue delivers at least once, so a job can arrive twice. Use the unique keys (`dailyReports.idempotencyKey`, `deliveries.idempotencyKey`).
- A message holds ids and a job type only. The handler rebuilds the tenant context and skips work if the company is suspended.
- Delete a message only after the job succeeded. After five failed attempts the message moves to the poison queue.

## Errors, logging, config

- One global exception filter returns RFC 9457 problem details with `code`, `requestId` and field `errors`. No stack traces or internal ids in responses.
- Log with pino as structured JSON with `requestId`, `tenantId`, `userId`. Never log tokens, secrets, request bodies, or plan and report text.
- All configuration goes through the typed, validated config module. No `process.env` anywhere else.

## Performance and security checks before you finish

- Does each new query have an index starting with `tenantId`? Is each list paginated?
- Does each by-id route load with `tenantId` and check scope?
- Is a denied-access test, an other-company test and (for plan items) an ownership test in the change?
