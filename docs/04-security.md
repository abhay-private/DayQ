# DayLoop – Security and Authentication (v0.1)

This document defines how DayLoop identifies people, decides what they may do, keeps each company's data separate and protects data and infrastructure. It builds on the PRD (v0.1), the System Architecture (v0.1) and the API Specification (v0.1). Every rule here is part of the Definition of Done and is repeated in the Copilot instructions.

## 1. Security goals

1. **Isolation:** a person from company A can never read or change anything of company B.
2. **Correct access:** every action is allowed only by the user's roles, scope and the ownership rule, and this is checked on the server.
3. **Integrity:** plans, time logs and leave history cannot be altered without a trace (append-only revisions, audit log).
4. **Confidentiality:** work data, reports and personal data are protected in transit, at rest and in logs.
5. **Accountability:** security-relevant actions, including every Super Admin access, are recorded.

## 2. Threats and controls

| Threat | Example | Main controls |
| --- | --- | --- |
| Cross-company data leak | Query without a tenant filter | Central tenant context, base repository, Mongoose plugin, isolation tests (section 7) |
| Broken object access | Changing an id in a URL to read another person's plan | Every by-id request loads the object with the tenant filter and checks scope (section 6) |
| Privilege escalation | A manager gives themselves a wider role | Grant rule: nobody can grant more than they hold; role and hierarchy changes audited |
| Mass assignment | Sending `tenantId` or `createdBy` in a request body | Whitelisted DTOs; these fields are never read from input |
| Stolen or forged token | Token for another app or another Entra tenant | Full token validation (section 4); unknown tenants refused |
| Ownership bypass | Employee edits a manager's task | `PlanItemPolicy` on the server, tested (FR-ASSIGN-3) |
| Injection | NoSQL operators in JSON input, HTML in plan text | Schema validation, operator rejection, output escaping |
| Report abuse | HTML or links in plan text reaching PDF or email | Escape all user text; templates are data, not HTML; PDF service has no internet access |
| Secret leak | Keys in the repository or in logs | Key Vault, managed identities, secret scanning, log redaction |
| Supply chain | Vulnerable or malicious package | Dependency scan, lockfiles, review of security paths, pinned images |
| Insider misuse | Super Admin browsing client data | Audit of every access, least privilege, read-only by default |
| Abuse and overload | Login or API flooding | Rate limits per IP, user and company; payload and page limits |

## 3. Identity with Microsoft Entra ID

DayLoop never stores passwords. Sign-in, password rules, MFA and conditional access are handled by the company's own Microsoft account.

### 3.1 App registrations

| Registration | Purpose | Key settings |
| --- | --- | --- |
| `dayloop-api` | The API (resource) | Multi-tenant, work and school accounts only (personal Microsoft accounts blocked). Exposes the scope `access_as_user`. Access token version 2. Application ID URI `api://<client-id>` |
| `dayloop-web` | The React web app | Single-page app platform, authorization code flow with PKCE, redirect URIs only for its own environment, permission to call `access_as_user` |
| `dayloop-android`, `dayloop-desktop` | Future clients | Public client platforms, PKCE, no secrets; added when those apps are built |

- Every environment (Dev, Test / QA, Staging, Production) has its own set of registrations, so a token from one environment is never valid in another.
- No client secrets in client apps. The API has no secret for user login; it only validates tokens.
- Microsoft Graph permissions are not needed for login. If Graph is used later (for example to send mail), it is requested separately with least privilege and admin consent.

### 3.2 Onboarding a company

1. The Super Admin creates the company in DayLoop (`POST /platform/tenants`) with the company's Entra tenant id and the first Admin's email.
2. That Admin opens DayLoop and signs in. Entra asks for consent to the app; if the company's rules require it, the company's Entra administrator grants admin consent once for the whole company.
3. The API maps the token to the company and the invited Admin (section 5). After that the Admin invites employees.

Until a company exists in DayLoop with status `trial` or `active`, nobody from that Entra tenant can use the API, even with a valid token.

## 4. Token validation (every request)

The API accepts only access tokens issued for `dayloop-api`. Checks, in order; any failure returns 401 and is logged without the token:

1. Signature is verified with Entra's published signing keys (cached, refreshed on unknown key id).
2. Token version is 2 and the algorithm is the expected one (no `none`).
3. Audience equals the API's application ID URI.
4. Issuer matches `https://login.microsoftonline.com/<tid>/v2.0` where `<tid>` is the tenant id inside the token. Because the app is multi-tenant, the issuer is checked per company and `<tid>` must belong to a known company.
5. `exp` and `nbf` are valid, with at most 60 seconds of clock skew.
6. The scope claim contains `access_as_user`.
7. The token is for a user, not an app (no application-only tokens on user endpoints).
8. Personal Microsoft account tokens are refused.

In Local and CI only, a mock OIDC issuer replaces Entra so automated tests do not depend on Microsoft (`AUTH_ISSUER_MODE=mock`, see the DevOps document). The API refuses to start with the mock issuer when `NODE_ENV` is Staging or Production, and a CI check verifies this.

Claims used: `tid` (company's Entra tenant), `oid` (the person), and `preferred_username` for display and invite matching. Nothing else in the token is trusted for authorization.

## 5. Mapping a token to a user

1. Find the company by `tid`. Not found, or status `suspended`: 403 `TENANT_SUSPENDED` or 403 `FORBIDDEN`.
2. Find the user by (`tenantId`, `oid`). If found and `active`, continue. If `deactivated`: 403.
3. If not found, look for a pending invitation in that company whose email matches `preferred_username`. If exactly one matches, bind the `oid` to that invited user, set the status to `active` and write an audit event. The binding happens once; later logins use the `oid` only.
4. If there is no invitation, return 403. The person is not auto-created, unless the company has switched on domain allow-listing in its settings (PRD FR-AUTH-2), and then the user gets only the default employee role.

External users in Phase 1 are guests invited into the company's own Entra tenant (Entra B2B). They arrive with the company's `tid` and follow the same flow, so they need no special code. Their access still depends on the company's setting `allowExternalUsers` and on their roles. Login by email code or another identity provider is not part of Phase 1.

A deactivated user is blocked on the next request, because the user status is part of the 60-second permission cache and is dropped immediately on deactivation in the instance that handled the change.

## 6. Authorization rules

The model (roles, permissions, scopes, ownership rule) is defined in the PRD section 9 and the Architecture section 5. The security rules on top of it:

1. **Deny by default.** An endpoint without `@RequirePermission` or an explicit `@Public` is rejected at startup in tests and at runtime in production.
2. **Server-side only.** The UI hides buttons, but the API is the only authority.
3. **Object-level checks.** Every endpoint that takes an id loads the object with the `tenantId` filter, then checks scope against the object's owner (`userId`). A missing or invisible object returns 404, not 403, so ids cannot be probed.
4. **No client-supplied identity.** `tenantId`, `createdBy`, `userId` of the actor, `version`, `status` of leave and similar fields come from the context or from server logic, never from the request body. DTOs reject unknown fields.
5. **Grant rule.** A user with `role.manage` can give a role only permissions and scopes they hold themselves. The Admin role holds all tenant permissions, so only an Admin can create another Admin-level role.
6. **Last Admin.** The last active Admin cannot be deactivated, demoted or deleted (`LAST_ADMIN`).
7. **Hierarchy rules.** A change that would create a cycle is refused. Moving a user rewrites `ancestorIds` for the whole subtree in one operation and bumps `authzVersion`.
8. **Separation of platform and company.** Platform routes accept only platform admin tokens. Company routes never accept a platform admin token as a company user, and the Super Admin has no company role.
9. **Change latency.** A permission, role or hierarchy change is effective on all instances within 60 seconds (cache expiry) and immediately on the instance that handled it.

## 7. Tenant isolation

The five layers are in the Architecture section 4. Security requirements on them:

- A repository or query that bypasses the tenant filter must be explicit (`PlatformRepository`), reviewed by a code owner, and audit-logged at runtime.
- Queue messages carry only ids (`tenantId`, `jobType`, entity id). The worker rebuilds the tenant context from the message and checks that the company is still active before it works.
- Blob paths start with the `tenantId`, for example `reports/<tenantId>/<date>/...`.
- Cached data, such as permissions, is keyed with `tenantId`.
- Automated isolation tests run on every pull request: for each endpoint, a user of company A tries to reach company B's objects and must get 404 or 403 (section 14).

## 8. Data protection

| Area | Requirement |
| --- | --- |
| In transit | HTTPS only with TLS 1.2 or higher; HTTP redirected; HSTS on web and API. Internal traffic between containers stays inside the Container Apps environment |
| At rest | Cosmos DB and Blob Storage encryption at rest (platform default). Customer-managed keys are optional later |
| Secrets | Azure Key Vault, injected as environment variables; managed identities for Blob, Queue and Key Vault access; no secrets in code, images or logs; rotation at least once a year and after any suspected leak |
| Report files | Private Blob container. A PDF is never reached by a public link: the API checks permission and streams it, or issues a short-lived link (minutes) after the check |
| Email and WhatsApp | A report email contains the report or a link that needs login, depending on the open decision in Architecture section 12. Recipients come only from `reportSubscriptions` set by the Admin |
| Personal data | Only what is needed: name, work email, role, manager, plan and time data. No phone numbers in Phase 1 unless WhatsApp delivery needs them, and then only for opted-in recipients |
| Backups | Cosmos DB backup retention and restore are enabled and tested once before go-live (verify the options of the chosen tier) |
| Deletion | Soft delete in the app. A company that leaves can export its data and then request permanent deletion, which removes all documents of that `tenantId` and its blobs |
| Environments | Real customer data never goes to Dev, Test / QA or Local. Those use seed data only |

## 9. API and application security

- **Transport and headers:** strict CORS allow-list per environment (no wildcard); security headers on API and web (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Content-Security-Policy`, `frame-ancestors none`).
- **Input:** schema validation on every endpoint with unknown fields rejected; maximum body size; maximum page size; strings trimmed and length-limited; enumerations checked.
- **NoSQL injection:** values that must be strings or numbers are rejected if they are objects (no `$` operators from users); queries are built only from validated fields, never from the raw request.
- **Output:** user text is always escaped. Plan descriptions, comments and leave reasons are plain text in Phase 1. If formatting is added later, a sanitizing allow-list is required.
- **Rate limiting:** stricter on unauthenticated routes, per user and per company on authenticated routes, with `429` and `Retry-After`. In Phase 1 the counters live in each instance's memory; with several replicas the effective limit is multiplied, so the limits are set with that in mind.
- **Error handling:** errors never include stack traces, queries or internal ids. Unexpected errors return `INTERNAL_ERROR` with a `requestId` only.
- **Idempotency and replay:** create endpoints accept `Idempotency-Key`; jobs are idempotent (Architecture 7.6).
- **File uploads:** none in Phase 1. If added: type and size limits, random names, a private container and a malware scan.
- **Test tools:** `/test/*` routes exist only when `ENABLE_TEST_TOOLS=true`; a CI check fails if Production enables it.

### 9.1 Report and PDF generation

- Report templates are structured data (section keys, order, branding), not free HTML. The HTML is produced by the server from fixed layouts with escaped values.
- `branding.logoUrl` accepts only an uploaded image stored by DayLoop or a validated `https` URL that is downloaded and checked once on save, never fetched during PDF rendering.
- The Gotenberg container is internal only and has no outbound internet access, so a malicious link or image in a report cannot cause a request to an outside or internal address.
- Email subjects and headers are built from fixed text plus escaped values; line breaks are stripped to prevent header injection.

## 10. Web app security

- MSAL stores tokens in session storage or memory, not in `localStorage`, and the app never logs tokens. Tokens are never put into URLs.
- Content Security Policy forbids inline scripts and third-party script hosts that are not needed. No `dangerouslySetInnerHTML` on user content.
- Routes are guarded in the UI for usability only; every API call is authorized on the server.
- Dependencies are limited and reviewed; the build runs a vulnerability scan.
- On logout the app clears its token cache and asks Entra to end the session.

## 11. Queue, worker and Azure infrastructure

- API and worker use managed identities with the smallest role that works: the API may add messages to the queue; the worker may read and delete them. No account keys or connection strings in configuration where a managed identity can be used.
- Messages carry no personal data, tokens or secrets, only ids and a job type. The poison queue has the same access rules as the main queue.
- Cosmos DB and Storage accept traffic only from the allowed networks: at least firewall rules or service endpoints in every environment. Private endpoints are recommended for Production once the cost is confirmed.
- Gotenberg and the worker have no public ingress. Only the API and the web app are reachable from the internet, behind HTTPS.
- Separate resource groups, databases and identities per environment. Production access is limited to named people and every access change is logged.

## 12. Audit and logging

Audit events are written to `auditLogs` by the application and cannot be edited or deleted through the API. Admins see their company's events (`audit.view`); platform events are visible to the Super Admin.

| Event | Recorded data |
| --- | --- |
| Login success, failure, invite binding | User, company, result, IP |
| User invited, activated, deactivated, reactivated | Actor, target |
| Role created, changed, deleted; roles assigned | Actor, target, permission differences |
| Hierarchy change or import | Actor, affected users |
| Company settings change | Actor, changed fields |
| Leave approved, rejected, cancelled | Actor, request |
| Report generated, sent, failed, viewed or downloaded by someone other than the subject | Actor, report |
| Report template or subscription change | Actor, differences |
| Super Admin: any company data access, suspend, reactivate, company creation | Actor, company, action |
| Permission denied (403) on sensitive endpoints, ownership violations | Actor, endpoint |

Logging rules: structured logs with `requestId`, `tenantId`, `userId`; never tokens, secrets, full request bodies or plan and report text; email addresses are masked in technical logs. Audit logs are kept for at least 12 months (open decision). Logs and alerts cover repeated failed logins, a spike of 403 or 429 responses, Super Admin access, and report or delivery failures.

## 13. Supply chain and delivery pipeline

- GitHub branch protection on `main`: pull request required, at least one review, all checks green, no direct pushes.
- Code owners are required for security-sensitive paths: auth, permissions, tenant context, repositories base, infrastructure, workflows.
- Dependabot or similar for npm packages and base images; `npm audit` and an OSV or similar scan block the merge on high severity; lockfiles committed; exact versions for critical packages.
- CodeQL static analysis, secret scanning with push protection, container image scan (for example Trivy) before deployment; base images pinned and minimal.
- GitHub Actions deploy to Azure with OIDC federation, not long-lived credentials. Workflow tokens have the minimum permissions.
- The same image is promoted from Dev to Production; production secrets are never available to pull-request builds.

## 14. Security testing

These extend the strategy in PRD section 7.1 and run in CI.

- **Token tests:** expired token, wrong audience, wrong issuer, unknown tenant id, token for another environment, application-only token, personal account token, missing scope. All must fail.
- **User state tests:** deactivated user, user not invited, suspended company.
- **RBAC matrix tests:** generated from the permission matrix, so a permission change without a test change fails the build.
- **Object access tests:** generated from the OpenAPI file; for every endpoint with an id, a user without scope and a user from another company must get 404 or 403.
- **Ownership tests:** employee edits manager task and the reverse, for every writable field.
- **Mass assignment tests:** forbidden fields in request bodies are ignored or rejected.
- **Injection tests:** operator objects and HTML in every string field.
- **Grant rule, last Admin and hierarchy cycle tests.**
- **Queue tests:** duplicate delivery of the same message sends nothing twice; a message for a suspended company is dropped.
- **Dynamic scan:** an OWASP ZAP baseline scan against Test / QA before each release, and a review of the results.
- **Pre-release checklist:** secrets, test tools off, CORS and headers, dependency scan, backup restore tested.

## 15. Privacy and compliance basics

Compliance means the legal and contractual rules for handling people's data. Employee names, work emails and what they worked on are personal data, so the rules apply once real people use DayLoop.

- **Now (own company):** use the controls above, tell employees what is recorded and who can see it, and keep the data inside the chosen Azure region.
- **Before selling to other companies:** get a legal review of the terms of service, the privacy policy and the data processing agreement. India's Digital Personal Data Protection Act, 2023 is likely relevant; a lawyer should confirm what applies and what the company must do as processor of its clients' employee data.
- **Built in from the start:** data stays tenant-separated, access is logged, data can be exported and deleted per company, and the Super Admin's access is limited and audited.
- **Region:** choose the Azure region for Cosmos DB, Storage and Container Apps deliberately and keep it the same in all production resources (open decision).

## 16. Incident response

1. Detect through alerts and reports; the owner is named in the runbook.
2. Contain: disable the affected user or company, rotate the affected secret, turn off the affected feature through its feature key.
3. Investigate with audit logs and request ids.
4. Notify the affected companies without delay and as the legal review requires.
5. Fix, add a regression test, and record the cause and the fix.

## 17. Security checklist for every change

- Endpoint has a permission key, scope and feature key, and appears in the OpenAPI file.
- Every query includes `tenantId`; every by-id access checks scope.
- DTO whitelists fields; no actor identity or `tenantId` from input.
- Tests exist for success, denied access, another company and ownership.
- No secrets or personal data in code, logs, queue messages or error responses.
- New dependencies are needed, maintained and scanned.
- Audit event added for any security-relevant action.

## 18. Open decisions

1. **Super Admin access to client data:** always visible and audited (current design), or only after the client grants time-limited support access?
2. **Audit log retention:** 12 months proposed.
3. **Private endpoints** for Cosmos DB and Storage in Production, after cost is known.
4. **Azure region** and data residency.
5. **Login for people outside Entra** (email code or another provider), a later phase.
6. **Phone numbers for WhatsApp:** where they are stored and how opt-in is recorded.
7. **Legal review** before the first outside client.
