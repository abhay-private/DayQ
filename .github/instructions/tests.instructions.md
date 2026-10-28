---
applyTo: "**/*.spec.ts,**/*.test.ts,**/*.test.tsx,**/e2e/**,**/test/**"
---
# Testing rules

Follow `docs/01-PRD.md` section 7.1 and `docs/04-security.md` section 14. The system is built test-first.

## General

- Write the failing test first. Name tests so they read as a rule, and put the FR-ID in the title: `[FR-PLAN-5] edit creates a revision with the changed fields`.
- Arrange, act, assert. One behaviour per test. No test depends on another.
- No real network calls, no real Microsoft, email or WhatsApp. No `sleep`; wait on conditions. Time comes from the injected `Clock`.
- Use data builders or factories for users, tenants, roles and plan items, not copy-pasted literals.

## Unit tests

Cover the permission and scope engine, `PlanItemPolicy` (ownership rule), revision logic, leave date-range handling and day status, time-log overlap and duration, time zone handling and report building. Include edge cases: first and last day of a range, daylight and zone changes, empty days, overlapping logs, last Admin, hierarchy cycles.

## Integration tests (API with real MongoDB and Azurite)

- Use a real MongoDB and the Azurite queue emulator in containers. Clean data between tests.
- For every endpoint test: success, validation failure, unauthenticated, forbidden (missing permission), insufficient scope, another company's object (expect 404 or 403), and version conflict where relevant.
- Tenant isolation: a user of company A must never read or change an object of company B.
- Queue tests: the same message delivered twice sends nothing twice; a message for a suspended company is dropped; five failures move the message to the poison queue.

## Security tests

- Token tests: expired, wrong audience, wrong issuer, unknown tenant, application-only token, missing scope. All fail.
- RBAC matrix tests are generated from the permission matrix. If a permission changes, its test changes in the same pull request.
- Object access tests iterate the endpoints of the OpenAPI file.
- Mass assignment and operator injection tests on every string field.

## End-to-end tests (Playwright)

- Run against the local stack with the mock OIDC issuer and seed data. Cover the journeys: login, plan today and tomorrow with history, manager assigns a task, time logging, evening report, leave request and approval, role creation, Super Admin suspend and reactivate.
- Use role-based selectors and stable test ids. Keep each journey independent and reset data per run.

## Quality gates

- Coverage at least 80 percent overall and at least 90 percent on permission, revision and report logic.
- Never skip or delete a failing test to get a green build. Fix the cause or ask.
- Every bug fix starts with a regression test.
