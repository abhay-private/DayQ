# DayLoop – PRD and Roles & Permission Matrix (v0.1)

Working title: **DayLoop** (name can change after domain check). Status: Draft v0.1. Audience: product owner, developers, GitHub Copilot (as project context).

## 1. Overview

DayLoop is a multi-tenant SaaS web application where employees plan their next day, log what they actually did (with start and end time per task), and where management automatically receives an end-of-day report: today's plan, today's actual work, and tomorrow's plan.

The loop: **Plan (evening) → Do and Log (during the day) → Report (evening) → Plan again.**

### 1.1 Problem statement

- Employees and managers do not know in advance what each person will work on today and tomorrow.
- There is no reliable record of how long each task actually took.
- Management has no automatic daily visibility into plan vs. actual work.
- Managers cannot assign prioritised, time-bound tasks inside an employee's daily plan without overwriting the employee's own plan.

### 1.2 Goals (Phase 1)

1. Microsoft login with the user's existing work account.
2. Daily plan for today and tomorrow, with add, edit and full edit history.
3. Time-wise work log: each task has a start time and an end time, so duration is known.
4. Manager can add prioritised tasks into a team member's plan without editing the employee's own entries.
5. Automatic daily report to the company Admin (and configured recipients) every evening.
6. Configurable organisation hierarchy and fully configurable roles and permissions.
7. Super Admin console to see and control client companies.
8. Modern, positive, enterprise-grade UI.

### 1.3 Non-goals for Phase 1 (see Future Scope)

Paid plans and billing, plan or module configuration UI, AI voice assistant, desktop app, Android app. Phase 1 is a free trial for everyone, but the data model must already support plans and feature entitlements (see section 8).

## 2. Tenancy and actors

| Actor | Description |
| --- | --- |
| **Super Admin** | Product owner. Operates the platform across all client companies. Not part of any tenant. |
| **Tenant (Company)** | A client company using DayLoop. Initially only the owner's own company. All data is isolated per tenant. |
| **Admin** | Owner or top administrator of a tenant. Adds employees, creates roles, sets hierarchy, receives the daily report. |
| **Custom roles** | Any role created by the Admin (for example Employee, Manager, HR, Team Lead). Roles are data, not code. |
| **External user** | A user outside the company's Microsoft tenant (contractor, consultant). Allowed only if the tenant enables it. |

Key rule: **roles are never hardcoded.** The system ships with editable starter role templates, but every role and every permission assignment is configurable per tenant.

## 3. Core concepts

- **Tenant**: a company account with status (active, suspended), trial info, settings (timezone, working days, report time, external users allowed).
- **User**: belongs to one tenant, has one or more roles, one manager (parent in the hierarchy), status (invited, active, deactivated), login type (Microsoft or external).
- **Hierarchy**: a tree of reporting lines defined by the Admin. It decides who can see whose plan and who can assign tasks to whom.
- **Daily Plan**: one per user per date. Contains plan items.
- **Plan Item**: a task in a daily plan. Fields: title, description, priority, planned start and end (optional), status, **owner of entry** (employee or manager), assigned by, actual time logs.
- **Time Log**: an actual work entry against a plan item (or an ad-hoc item): start time, end time, note. Duration is derived. One item can have several time logs.
- **Revision**: every edit to a plan item creates an immutable revision (who, when, what changed).
- **Daily Report**: generated per tenant (and per employee) at the configured time. Contains plan, actual, tomorrow's plan.
- **Report Template**: defines layout and sections of the report. Configurable per tenant.
- **Role / Permission**: a role is a named set of permissions with scopes (see section 9).

## 4. Daily lifecycle

1. **Evening (day D-1):** employee creates tomorrow's plan. Manager may add tasks into it at any time.
2. **Day D, during the day:** employee edits plan, adds ad-hoc tasks, and logs work with start and end time, either live or later in the day.
3. **Evening (day D):** employee finalises logs, then adds or edits tomorrow's plan (can still change it later).
4. **Report time (tenant-configurable):** the system generates and sends the report: today's plan vs. actual (with durations), and tomorrow's plan.
5. Logs can still be corrected after the report only according to the tenant's edit-window setting; corrections create revisions.

## 5. Functional requirements

### 5.1 Authentication and onboarding

- FR-AUTH-1: Login with Microsoft Entra ID (multi-tenant app registration, OIDC).
- FR-AUTH-2: A user can log in only if an Admin has added or invited them (or their domain is on the tenant allow-list).
- FR-AUTH-3: Tenant creation by Super Admin (and later via self-signup). The first user becomes Admin.
- FR-AUTH-4: External (non-Microsoft-tenant) users are supported only when the tenant setting "allow external users" is on; the allowed login method for them is configurable.
- FR-AUTH-5: Deactivated users cannot log in; their history is retained.

### 5.2 Users, roles, hierarchy (Admin)

- FR-ORG-1: Admin can add, invite, edit, deactivate users.
- FR-ORG-2: Admin can create, edit, clone and delete roles, and choose permissions and scopes for each role (section 9).
- FR-ORG-3: Admin can assign one or more roles to a user.
- FR-ORG-4: Admin can define the hierarchy (who reports to whom) with drag-and-drop tree and bulk import. No cycles allowed.
- FR-ORG-5: Task assignment and plan visibility follow the hierarchy and the role permissions.
- FR-ORG-6: Role deletion is blocked while users hold it unless reassigned.

### 5.3 Daily planning

- FR-PLAN-1: Each user sees a Today view and a Tomorrow view, plus a date navigator for other days.
- FR-PLAN-2: Employee can add, edit and delete (soft delete) their own plan items for today and future dates.
- FR-PLAN-3: Plan items have priority (for example Urgent, High, Medium, Low; priority labels configurable later), optional planned time window, status (Planned, In progress, Done, Carried over, Dropped).
- FR-PLAN-4: Unfinished items can be carried over to the next day in one click.
- FR-PLAN-5: Every create, edit, delete creates a revision. Any user with access can view the history of an item and compare versions.
- FR-PLAN-6: Each item clearly shows who created it (employee or manager) with a visual badge.

### 5.4 Manager task assignment

- FR-ASSIGN-1: A user with the "assign tasks" permission can add items into the daily plan of a user within their allowed scope (direct reports or entire subtree, per role configuration).
- FR-ASSIGN-2: Manager-created items carry priority, optional time window and due date.
- FR-ASSIGN-3: **Ownership rule:** the employee cannot edit or delete manager-created items; the manager cannot edit or delete employee-created items. The employee can update the *status and time logs* of manager-assigned items; the manager can only change their own items.
- FR-ASSIGN-4: Employee can comment on a manager-assigned item (for example to request a change). Comments are visible to both.
- FR-ASSIGN-5: Manager can view the full plan and time logs of everyone in their scope (read-only for employee-owned content).

### 5.5 Time logging

- FR-LOG-1: Employee can log work per task with start time and end time (live start/stop timer, or manual entry afterwards).
- FR-LOG-2: Duration is computed automatically. Overlapping logs for the same user trigger a warning (configurable to block).
- FR-LOG-3: Ad-hoc work (not in plan) can be logged and is marked as "unplanned".
- FR-LOG-4: A Day Timeline view shows planned vs. actual on a time axis, and total tracked hours vs. the tenant's working hours.
- FR-LOG-5: Back-dated logs are allowed within the tenant's edit window; all changes are versioned.

### 5.6 Daily report and notifications

- FR-REP-1: At the tenant's configured time (in the tenant timezone), the system generates a daily report per employee and a consolidated report.
- FR-REP-2: Report content: today's plan, actual work with start, end and duration for each task, planned vs. done summary, unplanned work, leave or holiday status, tomorrow's plan.
- FR-REP-3: Recipients are configurable: the Admin by default, plus additional people or roles (for example each manager receives their team's report).
- FR-REP-4: Channel: email in Phase 1 (provider credentials from environment variables). WhatsApp via AiSensy is optional and configurable.
- FR-REP-5: Report templates are configurable per tenant (sections on or off, order, branding). Phase 1 ships one default template, but the template is stored as data, not hardcoded.
- FR-REP-6: Reports are stored and can be re-viewed in the app, and can be exported as PDF.
- FR-REP-7: Reminders: configurable nudges, for example "you have not planned tomorrow yet" before the report time.
- FR-REP-8: Failed deliveries are retried and visible in a delivery log.

### 5.7 Dashboards

- FR-DASH-1: Employee dashboard: today's plan, progress, tracked hours.
- FR-DASH-2: Manager dashboard: team status today, who has not planned, who is overloaded, priority items.
- FR-DASH-3: Admin dashboard: company-wide summary and report history.

### 5.8 Super Admin console

- FR-SA-1: List of all client companies with status, join date, number of employees, last activity, trial or plan info.
- FR-SA-2: Open a client's details and data summary.
- FR-SA-3: Activate, suspend or reactivate a client account. Suspended tenants cannot log in; data is retained.
- FR-SA-4: Every Super Admin access to client data is audit-logged.
- FR-SA-5: Create a tenant and its first Admin.

### 5.9 Audit

- FR-AUD-1: Security-relevant events (login, role change, permission change, hierarchy change, report sent, Super Admin access) are logged and viewable by the Admin.

### 5.10 Leave and holidays

- FR-LEAVE-1: Employee applies for leave with a **reason** and a **from date and to date**. One request covers the whole range; the employee never enters leave day by day.
- FR-LEAVE-2: The request goes to the employee's manager (per the hierarchy and the `leave.approve` permission). The manager approves or rejects with an optional comment. The Admin is the fallback approver when the employee has no manager.
- FR-LEAVE-3: Employee can cancel a pending request, and an approved one before it starts.
- FR-LEAVE-4: Admin configures the holiday calendar and the weekly off days (default Saturday and Sunday).
- FR-LEAVE-5: Every day inside an approved leave range is marked "On leave" automatically, together with the reason. Holidays and weekly offs are marked the same way ("Holiday", "Weekly off"). On such days planning and time logs are optional and no "not planned" reminder is sent.
- FR-LEAVE-6: The daily report shows this status in its own clear line, for example "On leave (12 Nov to 14 Nov): family function", never as missing or empty. A request still waiting for approval shows "Leave requested, awaiting approval".
- FR-LEAVE-7: Managers and Admin see a team leave calendar and get a warning when assigning a task to someone who is on leave.
- FR-LEAVE-8: Every request, approval, rejection and cancellation is versioned and audit-logged.

Out of scope for Phase 1: leave types, yearly quotas, balances and accrual. They can be added later behind feature keys.

## 6. Business rules

1. All data is isolated by `tenantId`. No query runs without a tenant filter.
2. Plan visibility = user's own plan, plus plans inside the scope granted by role permission and hierarchy.
3. Entries are immutable once saved: edits create revisions, deletes are soft deletes.
4. Ownership rule of FR-ASSIGN-3 is enforced on the server, never only in the UI.
5. A user's last Admin cannot be removed or deactivated.
6. Time logs cannot be in the future; end time must be after start time.
7. During Phase 1 every tenant has all features (trial). Feature checks still go through the entitlement layer.

## 7. Non-functional requirements

- **Security:** HTTPS only, OIDC token validation, server-side RBAC on every endpoint, secrets only in environment variables, rate limiting.
- **Performance:** key screens load in under 2 seconds on a normal connection for a tenant of 500 users.
- **Scalability:** stateless API containers on Azure Container Apps; background jobs run on a separate worker fed by an Azure Storage Queue, so no request waits for an email or report.
- **Reliability:** report jobs are idempotent (a report is never sent twice for the same day) and retried on failure.
- **Timezones:** all timestamps stored in UTC, displayed in tenant or user timezone.
- **Accessibility and UX:** responsive web, keyboard friendly, WCAG AA contrast, modern positive visual design (design tokens to be defined once references are shared).
- **Observability:** structured logs, error tracking, job monitoring.
- **Data retention:** soft delete plus configurable retention; export of tenant data on request.

### 7.1 Quality, testing and environments

DayLoop is built test-driven. Tests are a Phase 1 requirement and part of the Definition of Done, not a later phase.

- **Process:** business logic is written test-first. No feature is Done without automated tests, and every FR-ID maps to at least one test (a traceability table lives in the repo).
- **Unit tests:** permission and scope engine, ownership rule (FR-ASSIGN-3), revision logic, leave date-range expansion, time-log overlap and duration, timezone handling, report generation.
- **Integration tests:** API with a real MongoDB and the Azurite queue emulator in containers, including queue jobs, retries and report idempotency (a report is never sent twice for a day).
- **API contract tests:** every endpoint is checked against the OpenAPI specification.
- **Component tests:** React components with Testing Library.
- **End-to-end tests (Playwright):** login, create and edit plan with history, manager assigns a task, time logging, evening report, leave request and approval, role creation, Super Admin suspend and reactivate.
- **Security tests:** tenant isolation (a user from company A can never read company B), and RBAC tests generated from the permission matrix in section 9, so a permission change without a test change fails the build.
- **Non-functional tests:** load test (k6) for a 500-user tenant, accessibility checks (axe) inside the end-to-end suite.
- **Gates:** a pull request cannot merge if lint, type-check, unit, integration or end-to-end smoke tests fail. Coverage target is at least 80% overall and 90% on permission, revision and report logic. The full end-to-end and security suites run nightly.
- **Bugs:** every bug gets a regression test before its fix is merged.

| Environment | Purpose | Data | Notifications |
| --- | --- | --- | --- |
| Local | Developer machine, docker compose (MongoDB, Azurite queue emulator, mail catcher, Gotenberg) | Seed script | Mail catcher only |
| Dev | Shared integration of the latest main branch | Seed data | Sandbox inbox |
| Test / QA | Stable environment where anyone can test; reset to seed on demand | Two demo companies, about 30 users, a three-level hierarchy, plans, time logs, leaves, one user per role | Sandbox inbox; WhatsApp off or sandbox |
| Staging | Production-like final check before release | Anonymised or synthetic | Allow-listed test recipients only |
| Production | Live | Real | Real |

The Test / QA environment also has test-only helpers: a button or command to run the evening report immediately, a date simulator for leave and holiday scenarios, test accounts for every role, and a one-click reset to seed data. Test environments never send email or WhatsApp to real people.

### 7.2 API-first backend and API documentation

The backend is a single API that every client uses. The web app is only the first client; the Android and desktop apps (future scope) will call the same API and will not get a separate backend.

- **One API for all clients:** the web app has no private endpoints. All business rules (permissions, ownership rule, revisions, leave, reports) live in the backend and are never re-implemented in a client.
- **Versioned:** all routes live under `/api/v1`. A breaking change ships as a new version; old versions are deprecated with notice.
- **OpenAPI 3.1 is the contract:** every endpoint is described in the OpenAPI specification (kept in the repo as `docs/api/openapi.yaml`) with its purpose, authentication, required permission key, request and response schemas, error codes and examples.
- **Docs are part of the build:** an endpoint without documentation is not Done. CI fails when the specification is missing or out of date, and the contract tests in section 7.1 check the API against it.
- **Interactive docs:** the specification is published as interactive API documentation (Swagger UI or Scalar) in the Dev and Test / QA environments, so anyone can read and try the API.
- **Generated client:** a typed TypeScript client is generated from the specification and used by the web app now and by other clients later.
- **Standard authentication:** the API accepts OAuth 2.0 bearer tokens issued by Microsoft Entra ID. Mobile and desktop apps sign in with the authorization code flow with PKCE, so the API never depends on browser cookies.
- **Consistent conventions:** pagination and filtering on every list, one error format (RFC 9457 problem details), ISO 8601 UTC timestamps, idempotency keys on create actions, rate limits per tenant.
- **Realtime and notifications:** live updates (WebSocket or SSE) and notification channels are documented in the same way and designed as channels, so mobile push can be added without changing the core.
- **API changelog:** every API change is recorded in a changelog in the repo.

### 7.3 Code quality, performance and security standards

These standards apply to every line of code, whether written by a developer or by GitHub Copilot. They are part of the Definition of Done and are repeated in the Copilot instructions file.

**Clean and well structured**

- Modular monolith: one backend with a module per domain (auth, tenants, users and roles, hierarchy, plans, tasks, time logs, leave, reports, notifications, admin). Modules talk through defined interfaces, never through each other's database collections.
- Strict layering: controller (HTTP only) → service (business rules) → repository (database only). No business logic in controllers, no database calls in services.
- TypeScript strict mode everywhere; ESLint and Prettier enforced in CI; one documented folder structure and naming convention; no dead code, no copy-pasted logic.
- Input is validated with schemas at the edge (DTOs), and shared types live in one package used by the backend and the web app.
- Important design decisions are recorded as short Architecture Decision Records in the repo.

**SOLID**

- **Single responsibility:** small classes and functions with one reason to change (for example, report generation, report delivery and report scheduling are separate).
- **Open/closed:** new notification channels (email, WhatsApp, push later), report templates and leave rules are added by writing a new implementation, not by editing existing code.
- **Liskov substitution:** every implementation of an interface can replace another without surprises (for example, a real mail sender and a test mail sender).
- **Interface segregation:** small, focused interfaces instead of one large service contract.
- **Dependency inversion:** business logic depends on interfaces (mail, WhatsApp, file storage, clock, queue), and the concrete providers are injected. This also keeps unit tests fast and simple.

**Optimised and fast**

- Every query has a planned index, with `tenantId` first. Lists are paginated, queries return only the fields needed, and N+1 query patterns are not allowed.
- Permission and role resolution is cached in memory for a short time and invalidated when roles or the hierarchy change.
- Slow work (reports, PDF generation, email and WhatsApp delivery) runs in background jobs, never inside a request.
- Responses are compressed. The web app uses code splitting, lazy loading and cached server state.
- Performance budgets: p95 response time under 300 ms for common read endpoints, key screens usable in under 2 seconds. The load test in section 7.1 checks them.

**Highly secure**

- Authorization is deny-by-default and checked on the server for every endpoint through one central guard that reads the permission matrix. The tenant filter is applied centrally, not by hand in each query.
- The OWASP Top 10 and ASVS are the baseline: schema validation on all input, protection against NoSQL operator injection, output encoding, CSRF and XSS protection, strict CORS allow-list, security headers, rate limiting per tenant and per user.
- Secrets only in environment variables or Azure Key Vault, never in the repository. Azure services use managed identities with least privilege.
- Encryption in transit (HTTPS only) and at rest. Short-lived access tokens. No tokens, personal data or secrets in logs.
- Automated checks in CI: dependency vulnerability scan, static analysis (CodeQL), secret scanning. Security-relevant events go to the audit log (FR-AUD-1).
- File uploads, if any, have type and size limits and are scanned or stored outside the application server.

**How it is enforced**

- Pull requests need a review against a short checklist covering the points above, and CI blocks the merge on lint, type, test, coverage and security-scan failures.
- The same rules go into `.github/copilot-instructions.md` so Copilot writes code that already follows them.

## 8. Future scope (design for it now, build later)

1. **Plans and entitlements:** Super Admin can create multiple plans (Free, Paid now; Free, Basic, Standard, Premium later). Each plan is a configurable set of modules and sub-modules (feature keys) and limits. Phase 1 builds only the data model and a `hasFeature(tenant, featureKey)` check; the UI and billing come later.
2. **Trial then paid:** all tenants get a free trial at first; later the trial end date and plan assignment control access.
3. **AI personal assistant:** voice in and voice out for management, answering questions like "What did X do today?", "Did X follow today's plan?", with visuals. Access to the agent is configurable by role.
4. **Desktop and Android apps.**
5. Integrations: Microsoft Teams, calendar import, other task tools.

Phase 1 must not block any of these: use feature keys for every module, keep an API-first backend, keep all reporting data queryable.

## 9. Roles and permission matrix

### 9.1 How permissions work

A permission is a key plus a **scope**. Scopes, from narrowest to widest:

- `own`: only the user's own data
- `direct`: direct reports
- `subtree`: everyone below the user in the hierarchy
- `tenant`: everyone in the company
- `platform`: across all companies (Super Admin only, never assignable to tenant roles)

Admin creates roles by ticking permissions and choosing a scope for each.

### 9.2 Permission keys

| Module | Permission key | Meaning | Allowed scopes |
| --- | --- | --- | --- |
| Plan | `plan.view` | View daily plans and time logs | own, direct, subtree, tenant |
| Plan | `plan.create` | Create plan items for self | own |
| Plan | `plan.edit` | Edit own plan items | own |
| Plan | `plan.history.view` | View revision history | own, direct, subtree, tenant |
| Assignment | `task.assign` | Add manager-owned items into someone's plan | direct, subtree, tenant |
| Assignment | `task.edit_assigned` | Edit or remove items the user themselves assigned | own |
| Time log | `timelog.create` | Log time for self | own |
| Time log | `timelog.edit` | Edit own time logs | own |
| Time log | `timelog.view` | View others' time logs | direct, subtree, tenant |
| Report | `report.view` | View stored daily reports | own, direct, subtree, tenant |
| Report | `report.receive` | Receive the daily report by email or WhatsApp | direct, subtree, tenant |
| Report | `report.template.manage` | Manage report templates and schedule | tenant |
| Dashboard | `dashboard.view` | View dashboards | own, direct, subtree, tenant |
| Users | `user.view` | View user directory | tenant |
| Users | `user.manage` | Add, edit, deactivate users | tenant |
| Roles | `role.manage` | Create and edit roles and permissions | tenant |
| Hierarchy | `hierarchy.manage` | Edit reporting lines | tenant |
| Settings | `tenant.settings.manage` | Timezone, working days, external users, edit windows | tenant |
| Audit | `audit.view` | View audit log | tenant |
| Platform | `platform.tenants.manage` | View, activate, suspend client companies | platform |
| Platform | `platform.plans.manage` | Manage plans and entitlements (future) | platform |
| Leave | leave.apply | Apply for own leave and cancel own requests | own |
| Leave | leave.approve | Approve or reject leave requests | direct, subtree, tenant |
| Leave | leave.view | View others' leave and the team leave calendar | direct, subtree, tenant |
| Leave | leave.config.manage | Manage the holiday calendar and weekly off days | tenant |

### 9.3 Starter role templates (editable, not hardcoded)

| Permission | Employee | Manager | Management / HR | Admin | Super Admin |
| --- | --- | --- | --- | --- | --- |
| `plan.view` | own | subtree | tenant | tenant | platform (audited) |
| `plan.create`, `plan.edit` | own | own | own | own | n/a |
| `plan.history.view` | own | subtree | tenant | tenant | platform (audited) |
| `task.assign` | no | direct (or subtree) | no | tenant | no |
| `task.edit_assigned` | no | own | no | own | no |
| `timelog.create`, `timelog.edit` | own | own | own | own | n/a |
| `timelog.view` | own | subtree | tenant | tenant | platform (audited) |
| `report.view` | own | subtree | tenant | tenant | platform (audited) |
| `report.receive` | no | subtree | tenant | tenant | no |
| `report.template.manage` | no | no | no | tenant | no |
| `dashboard.view` | own | subtree | tenant | tenant | platform |
| `user.view` | no | subtree | tenant | tenant | platform |
| `user.manage` | no | no | no | tenant | platform |
| `role.manage` | no | no | no | tenant | no |
| `hierarchy.manage` | no | no | no | tenant | no |
| `tenant.settings.manage` | no | no | no | tenant | platform |
| `audit.view` | no | no | no | tenant | platform |
| `platform.tenants.manage` | no | no | no | no | yes |
| `platform.plans.manage` | no | no | no | no | yes (future) |
| leave.apply | own | own | own | own | n/a |
| leave.approve | no | direct | no | tenant | no |
| leave.view | own | subtree | tenant | tenant | platform (audited) |
| leave.config.manage | no | no | no | tenant | no |

Notes: Super Admin is a platform-level account outside any tenant, so the role is a system role that cannot be created or edited by tenants. Admin is the only tenant role guaranteed to exist (the first user). All other roles above are only seeded defaults that an Admin can rename, edit or delete.

### 9.4 Ownership rules (the edit matrix)

| Who created the item | Employee (assignee) can | Assigning manager can | Another manager can |
| --- | --- | --- | --- |
| Employee | Edit, delete, change status, log time | View, comment | View (if in scope), comment |
| Manager | View, comment, change status, log time | Edit, delete | View (if in scope) |

## 10. Success metrics

- Percentage of employees who submit tomorrow's plan before report time.
- Percentage of working hours covered by time logs.
- Daily report delivery success rate (target above 99%).
- Weekly active users per tenant.
- Time for Admin to onboard a company with 50 users (target under 30 minutes).

## 11. Assumptions and open questions

**Assumptions made in this draft (please confirm or correct):**

1. Report goes to the Admin by default; extra recipients (managers, HR) are configurable. Confirmed.
2. One user has one manager, but can hold multiple roles.
3. Report time is per tenant, in the tenant timezone.
4. Priority levels are fixed in Phase 1 (Urgent, High, Medium, Low).
5. Manager-assigned items can be commented on by the employee, but only the manager can edit them.
6. Edit window for back-dated logs is a tenant setting; default 7 days.

**Open questions:**

1. Resolved: manager-assigned items go straight into the employee's plan, with no accept step.
2. Resolved: leave and holidays are in Phase 1 (section 5.10); weekends follow each tenant's weekly off days.
3. Should the report also be visible to the employee's direct manager automatically, or only to configured recipients?
4. For external users, which login method is allowed (email OTP, Google, or invited Microsoft guest)?
5. Maximum team size per manager and maximum hierarchy depth to design for?
