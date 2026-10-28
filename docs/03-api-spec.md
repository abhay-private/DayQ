# DayLoop – API Specification (v0.1)

DayLoop has one REST API under `/api/v1`. The web app, and later the Android and desktop apps, use only this API. This document defines the conventions and the endpoint catalogue with the permission each endpoint needs. The machine-readable contract, `openapi.yaml`, is generated from the code and checked in CI against this design. It builds on the PRD (v0.1) and the System Architecture (v0.1).

## 1. Source of truth

- The code is annotated (NestJS decorators) and the OpenAPI 3.1 file is generated from it into `docs/api/openapi.yaml`. This document is the design the code must match; a difference is a bug in one of the two.
- CI fails when the generated file is missing, out of date, or when an endpoint has no summary, permission, request or response schema and error list (PRD 7.2).
- Interactive documentation is served at `/docs` in Dev and Test / QA only. A TypeScript client is generated from the file for the web app and later clients.
- Every API change is added to `docs/api/CHANGELOG.md`. Breaking changes ship only in a new version (`/api/v2`).

## 2. Conventions

| Topic | Rule |
| --- | --- |
| Base URL | `/api/v1`. Health checks are `/health/live` and `/health/ready` (no token) |
| Format | JSON, UTF-8. Paths are kebab-case plural nouns, fields are camelCase, ids are strings |
| Authentication | `Authorization: Bearer <Entra ID access token>` on every endpoint except health checks. Tenant and user come from the token, never from the request |
| Dates | Calendar dates are `YYYY-MM-DD` in the tenant timezone. Instants are ISO 8601 in UTC, for example `2026-11-12T09:30:00Z`. Clock times are `HH:mm` |
| Lists | Cursor pagination with `limit` (default 25, maximum 100) and `cursor`. Response: `{ items, nextCursor }`. Filters are query parameters. Sort with `sort=field` or `sort=-field` |
| Create | `POST` returns 201 with the resource and a `Location` header. Create endpoints accept an `Idempotency-Key` header; the same key within 24 hours returns the first result |
| Update | `PATCH` with only the changed fields. Versioned resources need `expectedVersion`; a stale version returns 409 `VERSION_CONFLICT` |
| Delete | Soft delete, returns 204. History stays available |
| Errors | RFC 9457 problem details with a stable `code` (section 6) |
| Request id | Every response has `X-Request-Id`; it is repeated in error bodies and in logs |
| Rate limits | Per tenant and per user. 429 with `Retry-After` |
| Language | Messages are English. Clients use the `code`, never the message text |

Error body:

```json
{
  "type": "/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "code": "VERSION_CONFLICT",
  "detail": "The plan item was changed by someone else. Reload and try again.",
  "requestId": "req_8f2c1a",
  "errors": []
}
```

For validation errors (422), `errors` lists `{ "field": "...", "message": "..." }` entries.

## 3. How to read the permission column

- A permission is written as `key (scope)`. The caller needs that key with at least that scope; a wider scope also passes (PRD section 9).
- `any` means no permission key: any signed-in, active user acting on their own data.
- When the target is another user, the server resolves the scope with the hierarchy: `direct`, `subtree` or `tenant` must cover that user.
- The ownership rule (FR-ASSIGN-3) is checked in addition to the permission: only the creator of a plan item can edit or delete it. The assignee can change only its status and log time against it.
- Each module sits behind a feature key (PRD section 8). In Phase 1 every key is on for every company.

## 4. Endpoint catalogue

### 4.1 Session and company

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/me` | Profile, roles, effective permissions, company settings, feature flags | any |
| GET | `/tenant` | Company details | any |
| PATCH | `/tenant/settings` | Timezone, weekly off days, report time, external users, edit window, overlap policy | `tenant.settings.manage` (tenant) |

### 4.2 Users, roles, hierarchy (features `hierarchy`, `roles.custom`)

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/users` | List and search users | `user.view` |
| POST | `/users` | Add or invite a user | `user.manage` |
| GET | `/users/:id` | User details | `user.view` |
| PATCH | `/users/:id` | Edit user details | `user.manage` |
| POST | `/users/:id/deactivate` | Deactivate (the last Admin is refused) | `user.manage` |
| POST | `/users/:id/reactivate` | Reactivate | `user.manage` |
| PUT | `/users/:id/roles` | Replace the user's roles | `user.manage` |
| PUT | `/users/:id/manager` | Set or clear the manager; cycles are refused | `hierarchy.manage` |
| GET | `/hierarchy/tree` | Reporting tree from a root user | `user.view` |
| POST | `/hierarchy/import` | Bulk import reporting lines from CSV | `hierarchy.manage` |
| GET | `/roles` | List roles | `role.manage` |
| POST | `/roles` | Create a role with permissions and scopes | `role.manage` |
| GET | `/roles/:id` | Role details | `role.manage` |
| PATCH | `/roles/:id` | Edit a role | `role.manage` |
| DELETE | `/roles/:id` | Delete a role (refused while users hold it) | `role.manage` |
| POST | `/roles/:id/clone` | Copy a role | `role.manage` |
| GET | `/permissions` | Catalogue of permission keys with allowed scopes | `role.manage` |

### 4.3 Daily plan (features `plans.daily`, `assignments`)

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/days/:date?userId=` | Day view: day status, plan items, time logs, totals | `plan.view` (own or wider) |
| GET | `/plan-items?userId&from&to&status` | List plan items | `plan.view` |
| POST | `/plan-items` | Create. Own `userId`: a self item. Another user's `userId`: an assigned item | `plan.create` (own), or `task.assign` for another user |
| GET | `/plan-items/:id` | One item | `plan.view` |
| PATCH | `/plan-items/:id` | Edit title, description, priority, time window, due date. Creator only | `plan.edit` (own) for self items, `task.edit_assigned` (own) for items the caller assigned |
| PATCH | `/plan-items/:id/status` | Change status. The assignee can do this on every item in their plan | `plan.edit` (own) |
| DELETE | `/plan-items/:id` | Soft delete. Creator only | same as PATCH |
| POST | `/plan-items/carry-over` | Copy unfinished items to a later date | `plan.edit` (own) |
| GET | `/plan-items/:id/history` | Revisions of the item | `plan.history.view` |
| GET | `/plan-items/:id/comments` | Comments on the item | `plan.view` |
| POST | `/plan-items/:id/comments` | Add a comment (employee and assigning manager) | `plan.view` |

### 4.4 Time logs (feature `timelogs`)

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/time-logs?userId&from&to` | List logs | own: any; others: `timelog.view` |
| GET | `/time-logs/active` | The caller's running timer, if any | any |
| POST | `/time-logs` | Manual entry with start and end | `timelog.create` (own) |
| POST | `/time-logs/start` | Start a timer for a plan item or an unplanned title | `timelog.create` (own) |
| POST | `/time-logs/:id/stop` | Stop the timer | `timelog.edit` (own) |
| PATCH | `/time-logs/:id` | Edit a log inside the edit window | `timelog.edit` (own) |
| DELETE | `/time-logs/:id` | Soft delete inside the edit window | `timelog.edit` (own) |
| GET | `/time-logs/:id/history` | Revisions of the log | `timelog.view` |

### 4.5 Leave and holidays (feature `leave`)

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | /leave-requests?view=(mine, approvals, team)&status | List requests: the caller's own, those waiting for the caller's approval, or the team's | leave.apply (mine), leave.approve (approvals), leave.view (team) |
| POST | `/leave-requests` | Request leave with `fromDate`, `toDate`, `reason` | `leave.apply` (own) |
| GET | `/leave-requests/:id` | One request | own, or `leave.view` |
| POST | `/leave-requests/:id/cancel` | Cancel a pending request, or an approved one before it starts | `leave.apply` (own) |
| POST | `/leave-requests/:id/approve` | Approve, optional comment | `leave.approve` |
| POST | `/leave-requests/:id/reject` | Reject, optional comment | `leave.approve` |
| GET | `/leave-calendar?from&to` | Team leave and holidays on a calendar | `leave.view` |
| GET | `/holidays?year` | Holiday calendar | any |
| POST | `/holidays` | Add a holiday | `leave.config.manage` |
| PATCH | `/holidays/:id` | Edit a holiday | `leave.config.manage` |
| DELETE | `/holidays/:id` | Remove a holiday | `leave.config.manage` |

### 4.6 Reports (feature `reports.daily`)

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/reports?date&scope&userId` | Stored reports | `report.view` |
| GET | `/reports/:id` | One report snapshot | `report.view` |
| GET | `/reports/:id/pdf` | PDF of the report | `report.view` |
| GET | `/report-templates` | List templates | `report.template.manage` |
| POST | `/report-templates` | Create a template | `report.template.manage` |
| PATCH | `/report-templates/:id` | Edit sections, order, branding | `report.template.manage` |
| POST | `/report-templates/:id/preview` | Render a template with real data of a date, without sending | `report.template.manage` |
| GET | `/report-subscriptions` | Who receives which report | `report.template.manage` |
| POST | `/report-subscriptions` | Add a recipient, scope and channels | `report.template.manage` |
| PATCH | `/report-subscriptions/:id` | Change or pause a subscription | `report.template.manage` |
| DELETE | `/report-subscriptions/:id` | Remove a subscription | `report.template.manage` |
| GET | `/deliveries?status&from` | Delivery log with failures | `report.template.manage` |

### 4.7 Dashboards and audit

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/dashboards/me` | Employee dashboard | `dashboard.view` (own) |
| GET | `/dashboards/team` | Team status, who has not planned, overload, priority items | `dashboard.view` (direct or wider) |
| GET | `/dashboards/company` | Company-wide summary | `dashboard.view` (tenant) |
| GET | `/audit-logs` | Security and administration events | `audit.view` |

### 4.8 Realtime

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/events` | Server-Sent Events stream: task assigned, plan item changed, leave decided, report ready. Only events the caller may see | any |

### 4.9 Platform (Super Admin)

Routes under `/api/v1/platform` accept only platform admin tokens and are audit-logged (FR-SA-4).

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/platform/tenants` | Companies with status, join date, employee count, last activity | `platform.tenants.manage` |
| POST | `/platform/tenants` | Create a company and its first Admin | `platform.tenants.manage` |
| GET | `/platform/tenants/:id` | Company details and usage summary | `platform.tenants.manage` |
| POST | `/platform/tenants/:id/suspend` | Suspend a company | `platform.tenants.manage` |
| POST | `/platform/tenants/:id/reactivate` | Reactivate a company | `platform.tenants.manage` |
| GET | `/platform/audit-logs` | Platform-level audit events | `platform.tenants.manage` |

Future scope, not built in Phase 1: `/platform/plans` and `/platform/tenants/:id/subscription` for plans and entitlements.

### 4.10 Test tools (Test / QA only)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/test/reset` | Reset the environment to the seed data |
| POST | `/test/run-report?date` | Run the evening report now |
| POST | `/test/set-date` | Set the simulated date for leave and holiday scenarios |

These routes exist only when `ENABLE_TEST_TOOLS=true`. They are not registered otherwise, and a CI check fails if the Production configuration enables them.

## 5. Examples

A manager assigns a task to an employee:

```json
POST /api/v1/plan-items
{
  "userId": "665f1c2a9b1e4d0012ab34cd",
  "date": "2026-11-13",
  "title": "Prepare vendor comparison",
  "priority": "high",
  "plannedStart": "11:00",
  "plannedEnd": "13:00"
}
```

```json
201 Created
{
  "id": "665f1c8e9b1e4d0012ab3501",
  "userId": "665f1c2a9b1e4d0012ab34cd",
  "date": "2026-11-13",
  "title": "Prepare vendor comparison",
  "priority": "high",
  "status": "planned",
  "origin": "assigned",
  "createdBy": "665f1b119b1e4d0012ab3400",
  "version": 1
}
```

The employee tries to edit that task's title. This is refused with 403 and code `OWNERSHIP_VIOLATION`; changing its status or logging time still works.

An employee requests leave for a date range, once:

```json
POST /api/v1/leave-requests
{ "fromDate": "2026-11-12", "toDate": "2026-11-14", "reason": "Family function" }
```

The day view of an employee on approved leave:

```json
GET /api/v1/days/2026-11-13?userId=665f1c2a9b1e4d0012ab34cd
{
  "date": "2026-11-13",
  "userId": "665f1c2a9b1e4d0012ab34cd",
  "dayStatus": {
    "type": "leave",
    "reason": "Family function",
    "fromDate": "2026-11-12",
    "toDate": "2026-11-14"
  },
  "planItems": [],
  "timeLogs": [],
  "totals": { "plannedMin": 0, "trackedMin": 0 }
}
```

`dayStatus.type` is one of `working`, `leave`, `holiday`, `weeklyOff`. A pending request is shown as `pendingLeave: true` next to a `working` status.

## 6. Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | Missing, expired or invalid token |
| `FORBIDDEN` | 403 | The caller lacks the permission or the scope |
| `OWNERSHIP_VIOLATION` | 403 | Editing or deleting an item the caller did not create |
| `TENANT_SUSPENDED` | 403 | The company is suspended |
| `FEATURE_NOT_ENABLED` | 403 | The module is not part of the company's plan |
| `NOT_FOUND` | 404 | The resource does not exist or is not visible to the caller |
| `VALIDATION_FAILED` | 422 | Invalid input; `errors` lists the fields |
| `VERSION_CONFLICT` | 409 | `expectedVersion` is stale |
| `TIME_LOG_OVERLAP` | 409 | Overlap with another log while the policy is `block` |
| `TIME_LOG_OUTSIDE_WINDOW` | 422 | The log is older than the edit window |
| `LEAVE_OVERLAP` | 409 | The range overlaps another pending or approved request |
| `LAST_ADMIN` | 409 | The last Admin cannot be removed or deactivated |
| `ROLE_IN_USE` | 409 | The role still has users |
| `HIERARCHY_CYCLE` | 422 | The change would create a reporting cycle |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected error; the `requestId` is logged |

## 7. Documentation rules for every endpoint

- One OpenAPI tag per module, matching the section names above.
- Each operation has a summary, a description, the required permission key and scope, the feature key, request and response schemas, the list of error codes it can return, and at least one example.
- Schemas are defined once in `packages/shared` and reused by the backend, the OpenAPI file and the web app.
- Contract tests (PRD 7.1) call every endpoint and check the response against the OpenAPI file.

## 8. Open points

1. A running timer has no end yet. The `TimeLog` schema in the architecture document gets an optional `endAt` and `durationMin` until the timer is stopped.
2. Realtime uses Server-Sent Events in Phase 1 because it is simpler than WebSocket and works through the same bearer token. Mobile push can be added later as a notification channel.
3. The CSV columns for `/hierarchy/import` (suggested: `email`, `managerEmail`).
4. Whether `GET /users` should be limited to a manager's own subtree for roles without company-wide `user.view`.
