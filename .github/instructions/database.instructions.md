---
applyTo: "apps/api/src/**/schemas/**,apps/api/src/**/*.repository.ts,apps/api/migrations/**"
---
# Database rules (MongoDB API on Cosmos DB vCore)

Follow `docs/02-architecture.md` section 6 (data model, schemas, indexes) and `docs/05-devops.md` section 5 (migrations).

## Schemas

- Every tenant collection has `tenantId`, `createdAt`, `updatedAt` (UTC). Soft-deletable ones have `deletedAt`. Versioned entities have an integer `version`.
- Local calendar dates are `YYYY-MM-DD` text; instants are UTC dates. Enumerations are strings defined in `packages/shared`.
- Match the interfaces in the architecture document exactly. Do not add or rename fields without asking; changes go through the document first.
- `revisions` is append-only: no update or delete operations on it anywhere in the code.
- The hierarchy uses `managerId` and `ancestorIds`. Moving a user rewrites `ancestorIds` for the whole subtree in one operation and bumps `tenants.authzVersion`. Cycles are refused.

## Queries

- Always filter by `tenantId` first. Never pass request objects into a query.
- Use `lean()`, projections and cursor pagination. Avoid unbounded queries and N+1 patterns.
- Plan the index for every new query pattern before writing it. Indexes start with `tenantId` and follow the table in the architecture document.
- Do not rely on multi-document transactions until support is verified on the chosen Cosmos DB vCore tier. Design each operation so a retry is safe (unique keys, idempotent updates).

## Migrations

- One script per change in `apps/api/migrations/`, named with a timestamp and a short description, run by the pipeline before the new revision gets traffic.
- Expand, then contract: add the new field or index first and keep the previous app version working; remove old fields in a later release.
- Create indexes only in migrations, never at application start outside Local.
- Every migration has a test that runs it against the seed data.
