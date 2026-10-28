# DayLoop – Implementation Roadmap (v0.1)

This roadmap turns the PRD, Architecture, API Specification, Security and DevOps documents into small tasks that GitHub Copilot can build one at a time. Export it to `docs/07-implementation-roadmap.md`. Task ids such as `M4-T03` are used in branch names, pull requests and the `implement-task` prompt.

## 1. How to use it

1. Work milestone by milestone, in task order. A task starts only when everything in its Needs column is done.
2. One task is one pull request. Branch: `feature/M4-T03-plan-item-policy`.
3. Create one GitHub issue per task (labels: milestone, size) and track them on a GitHub Project board. The status lives on the board, not in this document.
4. Give Copilot the task through the `implement-task` prompt. It reads the Refs, writes the tests first, implements, and reports assumptions.
5. A task is done only when the Definition of Done in `AGENTS.md` is met.
6. If a task turns out larger than its size, split it into two tasks instead of letting a pull request grow.

Sizes: **S** is one small change, **M** is one feature slice, **L** is large and should be split if it grows. Refs point to requirement ids (FR-...) and document sections (Arch = Architecture, API = API Specification, Sec = Security, Ops = DevOps).

## 2. Order at a glance

| Milestone | Outcome | Needs |
| --- | --- | --- |
| M0 Foundation | Repository, Azure Dev, Entra test tenant, pipelines, local stack | Nothing |
| M1 Backend core | Production-grade empty backend: context, tenancy, errors, OpenAPI | M0 |
| M2 Login, companies, users | Microsoft login works on Dev; Super Admin creates companies | M1 |
| M3 Roles, permissions, hierarchy | Configurable roles, guarded routes, reporting lines | M2 |
| M4 Daily plan and assignment | Plan, assign, ownership rule, history | M3 |
| M5 Time logs, leave, holidays | Time-wise logs, leave ranges, complete day view | M4 |
| M6 Queue, reports, notifications | Evening report reaches the Admin by email | M5 and the Report spec |
| M7 Dashboards, audit, realtime, test tools | Backend feature-complete, seed data, Test / QA ready | M6 |
| M8 Web foundation | Web login, app shell, design system | UI/UX spec; M3 for the API |
| M9 Web features | Every Phase 1 journey usable in the UI | M8 and the matching backend milestones |
| M10 Hardening and go-live | Full tests, security pass, production, pilot | M7 and M9 |

M8 can start in parallel with M4 to M7 once M3 is done, because the generated API client already exists.

## 3. Documents still to write

| Document | Needed before |
| --- | --- |
| Report and Notification Spec (`08-report-notification-spec.md`) | M6-T05 |
| UI/UX Spec (`09-ui-ux-spec.md`), needs your reference websites | M8-T02 |
| Runbooks (`docs/runbooks/`) | M10-T04 |

## 4. Decisions needed from the owner

| Decision | Needed before |
| --- | --- |
| Azure region and the resource group layout | M0-T02 |
| Email provider and sender address (as environment values) | M6-T03 |
| Whether the report email carries the PDF or a login link | M6-T08 |
| Domain name for the web app and the API | M10-T05 |
| Super Admin access model (always audited, or client-granted) | M2-T06 |

## 5. M0 Foundation

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M0-T01 | Create the GitHub repository from the structure in Architecture 3. Add the Copilot files, the documents, CODEOWNERS. Turn on branch protection, secret scanning, Dependabot and CodeQL | Ops 15.1 | None | S |
| M0-T02 | Azure Dev resources: resource group, storage account (queues `jobs`, `jobs-poison`, blob container `reports`), Cosmos DB database, Key Vault, Container Registry, Container Apps environment, Application Insights | Ops 3, 15.2, 15.4 | None | M |
| M0-T03 | Entra test tenant and the Dev app registrations `dayloop-api` (scope `access_as_user`) and `dayloop-web` | Sec 3.1 | None | S |
| M0-T04 | GitHub OIDC federation to Azure and one GitHub Environment per Azure environment | Ops 7 | M0-T02 | S |
| M0-T05 | Monorepo skeleton: pnpm workspaces, strict TypeScript, ESLint, Prettier, `packages/shared`, the scripts listed in `AGENTS.md` | Arch 3 | M0-T01 | M |
| M0-T06 | Local stack in `docker-compose.yml`: MongoDB, Azurite, mail catcher, Gotenberg, mock OIDC issuer | Ops 2, 15.6 | M0-T05 | M |
| M0-T07 | Pipelines `pr` (lint, type check, one test) and `main` (build image, push, deploy a health-only API to Dev) | Ops 7, 15.7 | M0-T04, M0-T05 | M |
| M0-T08 | Seed script skeleton and test data builders for tenants, users, roles, plan items | PRD 7.1 | M0-T05 | S |

Exit: a health-only API runs on Dev and the pipeline is green.

## 6. M1 Backend core

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M1-T01 | Typed, validated config module and `.env.example`; no `process.env` elsewhere | Ops 8 | M0-T05 | S |
| M1-T02 | Logging with pino, request id, global exception filter with RFC 9457 errors and shared error codes | API 2, 6 | M1-T01 | M |
| M1-T03 | MongoDB connection, schema conventions, `BaseRepository` with tenant filter, Mongoose plugin that rejects tenant queries without `tenantId` | Arch 4, 6.1 | M1-T01 | M |
| M1-T04 | `RequestContext` (tenant, user, permissions per request) and the `Clock` interface | Arch 4, 5 | M1-T01 | S |
| M1-T05 | Health endpoints `/health/live` and `/health/ready` | API 2 | M1-T03 | S |
| M1-T06 | OpenAPI generation, `/docs` outside Production, CI diff check, generated `packages/api-client`, `docs/api/CHANGELOG.md` | API 1 | M1-T02 | M |
| M1-T07 | Shared package: permission keys and scopes, feature keys, error codes, enums, base Zod schemas | PRD 9.2 | M0-T05 | M |
| M1-T08 | `Idempotency-Key` interceptor and cursor pagination helper | API 2 | M1-T03 | M |
| M1-T09 | Tenant isolation test harness: a two-company fixture used by every later test | Sec 14 | M1-T03 | S |

Exit: an empty but production-grade backend with the isolation harness tested.

## 7. M2 Login, companies, users

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M2-T01 | Token validation guard with the 8 checks, Entra issuer mode and mock issuer mode; refuse to start with the mock issuer in Staging or Production | Sec 4; Ops 2 | M1-T04 | M |
| M2-T02 | `FeatureGate` and `@RequireFeature` (always true in Phase 1) | Arch 9 | M1-T07 | S |
| M2-T03 | Tenants module with `GET /tenant` and `PATCH /tenant/settings` | FR-AUTH-3; API 4.1 | M1-T03 | M |
| M2-T04 | Users module: add or invite, list, get, edit, deactivate, reactivate, last-Admin rule | FR-ORG-1; API 4.2 | M1-T03, M1-T07 | L |
| M2-T05 | Audit module: `auditLogs` collection, writer service, insert-only | FR-AUD-1; Sec 12 | M1-T03 | S |
| M2-T06 | Platform admin routes: create, list, get, suspend, reactivate companies, audited, separate platform token check | FR-SA-1 to 5; API 4.9 | M2-T01, M2-T05 | M |
| M2-T07 | Token-to-user mapping: company by tenant id, user by object id, invite binding, suspended and deactivated handling | Sec 5; FR-AUTH-1 to 5 | M2-T01, M2-T04 | M |

Exit: a person signs in with Microsoft on Dev, is invited and mapped, and the Super Admin can create and suspend a company.

## 8. M3 Roles, permissions, hierarchy

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M3-T01 | Roles module: create, edit, clone, delete (blocked while in use), `GET /permissions`, seeded starter templates, revisions | FR-ORG-2, 6; API 4.2 | M2-T04 | L |
| M3-T02 | Permission resolution (union of roles, widest scope wins), 60-second in-memory `CacheStore`, `authzVersion` invalidation | Arch 5 | M3-T01 | M |
| M3-T03 | `PermissionGuard` deny-by-default, `@RequirePermission`, `@Public`, and a test that fails when a route has none | Sec 6.1 | M3-T02 | M |
| M3-T04 | Hierarchy: `managerId` and `ancestorIds`, set manager, cycle detection, subtree rewrite, tree endpoint, CSV import | FR-ORG-4; API 4.2 | M2-T04 | L |
| M3-T05 | `ScopeResolver` for own, direct, subtree and tenant | Arch 5 | M3-T02, M3-T04 | M |
| M3-T06 | Grant rule (nobody grants more than they hold) and last-Admin protection across roles and users | Sec 6.5, 6.6 | M3-T01 | S |
| M3-T07 | `GET /me` with profile, roles, effective permissions, company settings and feature flags | API 4.1 | M3-T02, M2-T02 | S |
| M3-T08 | Test generators: RBAC matrix tests from the permission matrix, object-access tests from the OpenAPI file | Sec 14 | M3-T03, M1-T06 | M |

Exit: an Admin creates roles and reporting lines; every route is guarded; the matrix tests run in CI.

## 9. M4 Daily plan and assignment

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M4-T01 | `RevisionService` and the append-only `revisions` collection with the unique entity id and version index | Arch 6.3 | M1-T03 | M |
| M4-T02 | Plan items for self: create, get, list, edit, soft delete with `expectedVersion` and revisions | FR-PLAN-1 to 3, 5; API 4.3 | M4-T01, M3-T05 | L |
| M4-T03 | `PlanItemPolicy` (ownership rule), tested for every field in both directions | FR-ASSIGN-3 | M4-T02 | M |
| M4-T04 | Assigned items: create for another user with `task.assign`, scope check, priority and time window | FR-ASSIGN-1, 2, 5 | M4-T03 | M |
| M4-T05 | Status change endpoint: the assignee changes the status of any item in their own plan | FR-ASSIGN-3; API 4.3 | M4-T03 | S |
| M4-T06 | Comments on plan items | FR-ASSIGN-4 | M4-T02 | S |
| M4-T07 | Carry over unfinished items to a later date | FR-PLAN-4 | M4-T02 | S |
| M4-T08 | `GET /plan-items/:id/history` | FR-PLAN-5 | M4-T01 | S |
| M4-T09 | `GET /days/:date` with plan items (time logs and day status added in M5) | API 4.3 | M4-T02 | S |

Exit: an employee plans tomorrow, a manager assigns a task, the ownership rule holds, and history is visible.

## 10. M5 Time logs, leave, holidays

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M5-T01 | Time logs: manual create, list, edit, soft delete, duration, edit window, overlap policy, revisions | FR-LOG-1 to 3, 5 | M4-T01, M3-T05 | L |
| M5-T02 | Timer: start, stop, active timer, unplanned work | FR-LOG-1, 3 | M5-T01 | M |
| M5-T03 | `GET /time-logs/:id/history` | FR-LOG-5 | M5-T01 | S |
| M5-T04 | Holidays CRUD and weekly off days in company settings | FR-LEAVE-4 | M2-T03 | S |
| M5-T05 | Leave requests: create with date range and reason, list views, get, cancel, overlap refusal | FR-LEAVE-1, 3 | M4-T01, M3-T05 | M |
| M5-T06 | Leave approval: resolve approver (manager, else Admin), approve, reject, audit | FR-LEAVE-2, 8 | M5-T05, M2-T05 | M |
| M5-T07 | `DayStatusService`: holiday, weekly off, approved leave, working, with a pending flag | FR-LEAVE-5; Arch 7.2 | M5-T04, M5-T06 | M |
| M5-T08 | Leave calendar and the warning when assigning a task to someone on leave | FR-LEAVE-7 | M5-T07, M4-T04 | M |
| M5-T09 | Complete the day view: time logs, day status, totals | API 4.3 | M5-T07, M4-T09 | S |

Exit: the day view shows plan, actual work and leave status.

## 11. M6 Queue, reports, notifications

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M6-T01 | `JobQueue` interface and the Azure Storage Queue implementation (managed identity), tested on Azurite | Arch 7.6 | M1-T01 | M |
| M6-T02 | Worker: polling with a growing wait, delete after success, dequeue count, poison queue | Arch 7.6 | M6-T01 | M |
| M6-T03 | `MailSender` interface, mail catcher implementation, first real provider (chosen by the owner) | Arch 8 | M1-T01 | M |
| M6-T04 | Report templates and subscriptions: CRUD, default template, default subscription to the Admin | FR-REP-3, 5; API 4.6 | M4-T01 | M |
| M6-T05 | Report snapshot generator: leave line, summary, planned versus done, timeline, unplanned work, tomorrow's plan, with a unique idempotency key | FR-REP-2; Arch 7.5 | M5-T09, M6-T04 | L |
| M6-T06 | Report rendering (escaped HTML from fixed layouts) and PDF through Gotenberg into the private blob container | FR-REP-6; Sec 9.1 | M6-T05 | M |
| M6-T07 | Scheduler job: finds companies past their report time in their time zone and queues generation | Arch 7.5 | M6-T02, M6-T05 | M |
| M6-T08 | Delivery pipeline: deliver jobs, `deliveries` log, retries, poison handling, resend | FR-REP-4, 8 | M6-T02, M6-T03, M6-T06 | L |
| M6-T09 | Reports API: list, get, PDF download through the API, template preview, delivery list | API 4.6 | M6-T06 | M |
| M6-T10 | Reminder: "tomorrow not planned", skipped on leave days, holidays and weekly offs | FR-REP-7 | M6-T07, M5-T07 | M |
| M6-T11 | WhatsApp through AiSensy behind `WhatsAppSender`, opt-in per recipient | FR-REP-4 | M6-T08 | M |

Exit: at report time the Admin receives the daily report, and duplicates never go out.

## 12. M7 Dashboards, audit, realtime, test tools

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M7-T01 | Dashboard endpoints: me, team, company | FR-DASH-1 to 3 | M5-T09, M3-T05 | M |
| M7-T02 | Audit log endpoint, and audit events wired into every security-relevant action | FR-AUD-1; Sec 12 | M2-T05 | M |
| M7-T03 | Realtime stream with Server-Sent Events: task assigned, item changed, leave decided, report ready | API 4.8 | M4-T04, M5-T06 | M |
| M7-T04 | Platform console data: usage summary per company, last activity | FR-SA-1, 2 | M2-T06 | S |
| M7-T05 | Test tools `/test/reset`, `/test/run-report`, `/test/set-date` behind `ENABLE_TEST_TOOLS`, plus the pipeline configuration check | Ops 9; API 4.10 | M6-T05 | M |
| M7-T06 | Full seed data for Test / QA: two companies, about 30 users, three-level hierarchy, plans, logs, leave, reports | PRD 7.1 | M6-T05 | M |
| M7-T07 | Rate limiting, security headers and CORS allow-list | Sec 9 | M1-T02 | S |
| M7-T08 | Deploy to Test / QA, nightly reset, mail inbox page | Ops 9 | M7-T05, M7-T06 | M |

Exit: the backend is feature-complete for Phase 1 and runs on Test / QA.

## 13. M8 Web foundation

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M8-T01 | Write `09-ui-ux-spec.md` from your reference websites: design tokens, screens, flows | PRD 1.3 | References from the owner | M |
| M8-T02 | Scaffold the web app: Vite, Tailwind, shadcn/ui, theme tokens, router, TanStack Query, generated API client | Web rules | M1-T06, M8-T01 | M |
| M8-T03 | Microsoft login and logout with MSAL, token handling, `/me` bootstrap, permission-aware navigation, no-permission page | Sec 10 | M8-T02, M3-T07 | M |
| M8-T04 | App shell: layout, navigation, top bar, loading, empty and error components, toasts | UI/UX | M8-T01, M8-T02 | M |

Exit: login works on Dev through the web app and the menus follow the user's permissions.

## 14. M9 Web features

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M9-T01 | Plan screens: today and tomorrow, add and edit items, priority, manager badge, history drawer, comments, carry-over | FR-PLAN-1 to 6; FR-ASSIGN-3, 4 | M8-T04, M4-T09 | L |
| M9-T02 | Time logging: timer, manual entry, unplanned work, Day Timeline (planned versus actual) | FR-LOG-1 to 5 | M9-T01, M5-T09 | L |
| M9-T03 | Leave: request with range and reason, my leave, approvals inbox, team calendar, leave and holiday banners | FR-LEAVE-1 to 8 | M8-T04, M5-T08 | L |
| M9-T04 | Manager views: team plans, assign a task, team dashboard | FR-ASSIGN-1, 5; FR-DASH-2 | M9-T01, M7-T01 | L |
| M9-T05 | Reports: list, view, PDF download | FR-REP-6 | M8-T04, M6-T09 | M |
| M9-T06 | Admin: users, roles and permission editor, hierarchy tree editor and import, company settings | FR-ORG-1 to 6 | M8-T04, M3-T08 | L |
| M9-T07 | Admin: report templates and recipients, delivery log, audit log | FR-REP-3, 5; FR-AUD-1 | M9-T06, M6-T09, M7-T02 | M |
| M9-T08 | Company dashboard for Admin and Management | FR-DASH-3 | M7-T01 | M |
| M9-T09 | Super Admin console: companies, details, suspend and reactivate | FR-SA-1 to 3 | M8-T04, M7-T04 | M |
| M9-T10 | Live updates in the UI through the event stream | API 4.8 | M7-T03 | S |

Exit: every Phase 1 journey is usable in the UI on Test / QA.

## 15. M10 Hardening and go-live

| ID | Task | Refs | Needs | Size |
| --- | --- | --- | --- | --- |
| M10-T01 | Playwright journeys in CI and nightly: login, plan with history, assignment, time logging, evening report, leave, role creation, suspend and reactivate | PRD 7.1 | M9-T01 to M9-T09 | L |
| M10-T02 | k6 load test for a 500-user company against the performance budgets | PRD 7.3 | M7-T08 | M |
| M10-T03 | Security pass: full security suite, ZAP baseline, dependency and image scans, checklist review, fixes | Sec 14, 17 | M9-T09 | L |
| M10-T04 | Backup restore drill; write and try the runbooks | Ops 11, 12 | M7-T08 | M |
| M10-T05 | Production through infrastructure code: resources, domain, Entra production registrations, Key Vault, alerts, budgets | Ops 3, 10, 13 | M10-T03 | L |
| M10-T06 | User acceptance on Test / QA with sample users from your company; sign-off checklist | Ops 9 | M10-T01 | M |
| M10-T07 | Production deploy with approval; pilot with your own company; watch the first week of reports | Ops 7 | M10-T05, M10-T06 | M |
| M10-T08 | Legal review of terms, privacy policy and data processing terms before the first outside client | Sec 15 | None | M |

## 16. After Phase 1 (future scope)

Not built in Phase 1. The hooks already exist (feature keys, `FeatureGate`, API-first design).

| ID | Item | Builds on |
| --- | --- | --- |
| F-01 | Plans and entitlements: Super Admin creates plans with modules and sub-modules, assigns them to companies; trial then paid | Architecture 9, `planDefinitions`, `subscriptions` |
| F-02 | Billing and payment gateway | F-01 |
| F-03 | AI personal assistant with voice in and out, with configurable access and visuals | The reporting data and the API |
| F-04 | Android app | The same API; PKCE app registration |
| F-05 | Desktop app | The same API; PKCE app registration |
| F-06 | Login for people outside Entra | Security 18 |
| F-07 | Shared cache and rate limiting store (Redis) if load needs it | `CacheStore` interface |
