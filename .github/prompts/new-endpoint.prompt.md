---
description: Add one API endpoint exactly as specified in the API document, with tests and OpenAPI
agent: agent
---
Add this endpoint: `${input:endpoint:Method and path, for example POST /plan-items}`.

1. Find it in `docs/03-api-spec.md` section 4 and use its purpose, permission and feature key exactly. If it is not listed there, stop and ask me.
2. Write failing integration tests first: success, validation failure (422), unauthenticated (401), missing permission (403), insufficient scope (403), another company's object (404 or 403), version conflict (409) where it updates, and the ownership rule where it touches plan items.
3. Implement the controller method (HTTP only), the service method (rules, scope check, policy, revision for updates, queue for slow work) and any repository method (tenantId first, indexed, paginated).
4. Add the OpenAPI decorators: summary, description, permission, feature key, schemas, error codes, example.
5. Run `pnpm openapi:generate`, then lint, type check, unit and integration tests.
6. Add an entry to `docs/api/CHANGELOG.md`.

Never read `tenantId` or the acting user from the request. Reject unknown fields.
