---
name: security-review
description: Review the current changes against the DayLoop security rules
disable-model-invocation: true
---
Review the changes in the current branch (or the selected files) against `docs/04-security.md`, especially section 6 (authorization), section 7 (tenant isolation), section 9 (API security) and the checklist in section 17, and against `.github/copilot-instructions.md`.

Check each point and answer with a table of finding, file and line, severity and suggested fix:

1. Every query includes `tenantId`; no bypass of the base repository.
2. Every endpoint has a permission key, scope and feature key; nothing is public by accident.
3. Every by-id access loads with `tenantId` and checks scope; hidden objects return 404.
4. No `tenantId`, actor id, `createdBy` or `version` is accepted from the request.
5. The ownership rule is enforced in the policy class, on the server.
6. Input is validated; unknown fields are rejected; `$` operator objects are rejected.
7. User text is escaped in reports, emails and PDFs.
8. No secrets, tokens or personal data in code, logs, queue messages or errors.
9. Jobs are idempotent and carry ids only.
10. New dependencies are justified and scanned.
11. Tests exist for denied access, another company and ownership.

Do not change any files. Say clearly when everything passes.
