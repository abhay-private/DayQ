## What changed
<!-- Short description. Reference the roadmap task id, for example M2-T05. -->

## FR-IDs covered
<!-- For example FR-PLAN-5, FR-ASSIGN-3 -->

## Tests
- [ ] Unit tests added or updated
- [ ] Integration tests added or updated (success, denied, insufficient scope, other company, ownership where relevant)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:int` pass

## API and documents
- [ ] OpenAPI regenerated and `docs/api/CHANGELOG.md` updated (if the API changed)
- [ ] Affected documents in `docs/` updated in this pull request

## Security checklist (docs/04-security.md section 17)
- [ ] Endpoints have permission key, scope and feature key
- [ ] Every query includes `tenantId`; every by-id access checks scope
- [ ] DTOs whitelist fields; no actor identity or `tenantId` from input
- [ ] No secrets, tokens or personal data in code, logs, queue messages or errors
- [ ] New dependencies are needed, maintained and scanned
- [ ] Audit event added for any security-relevant action

## Notes and open questions
