# DayLoop – System Architecture and Data Model (v0.1)

DayLoop is one API-first modular monolith with a background worker, MongoDB-compatible storage and Azure Storage queues, deployed as containers on Azure. Every record belongs to a tenant, and every change to plans and time logs is kept as an append-only revision. This document is the technical base for the API specification, the security document and the Copilot instructions. It builds on the PRD (v0.1); FR-IDs and section numbers refer to it.

## 1. Key decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Style | Modular monolith: one codebase, two entrypoints (API and worker) | One team, fast delivery, clear module boundaries; a module can become a service later |
| Backend | Node.js, NestJS, TypeScript strict mode | Modules, guards and dependency injection fit SOLID and the permission model |
| Database | MongoDB API on Azure Cosmos DB vCore, with Mongoose | Already used by the team; documents suit plan items and report snapshots |
| Queue | Azure Storage Queue behind a JobQueue interface | Mail and report jobs run in the background without blocking the API; low cost; Service Bus can replace it later |
| Tenancy | Shared database, `tenantId` on every document | Cheap to run for many small clients; isolation enforced centrally and tested |
| Identity | Microsoft Entra ID, multi-tenant app registration, OIDC | Login with the existing Microsoft account; token carries `tid` and `oid` |
| Authorization | Roles and permissions stored as data, resolved on the server | Roles are configurable per company (PRD section 2) |
| Hierarchy | `managerId` plus an `ancestorIds` array on each user | One indexed query returns direct reports or a whole subtree |
| Versioning | One append-only `revisions` collection | Same mechanism for plan items, time logs, leave, roles and templates |
| Dates | Calendar dates stored as `YYYY-MM-DD` text in the tenant timezone; instants stored in UTC | Avoids timezone bugs in today, tomorrow and reports |
| Deletes | Soft delete with `deletedAt` | History and audit are never lost |
| Reports | A snapshot is stored when the report is generated | A sent report never changes and can be re-viewed or exported |
| Day status | Computed, not stored (holiday, weekly off, approved leave) | A leave range needs no per-day rows |

## 2. System overview

| Component | Technology | Responsibility |
| --- | --- | --- |
| Web app | React, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query; Azure Static Web Apps | UI; uses only the public API through the generated client |
| API | NestJS container on Azure Container Apps | REST `/api/v1`, authentication, permissions, business rules, OpenAPI docs |
| Worker | Same codebase, second entrypoint, container | Queue jobs: report generation, delivery, reminders; polls the queue |
| Database | Azure Cosmos DB for MongoDB vCore | System of record |
| Queue | Azure Storage Queue | Background jobs, and a poison queue for jobs that keep failing |
| PDF service | Gotenberg container (internal only) | HTML to PDF for reports |
| File storage | Azure Blob Storage | Report PDFs, future attachments |
| Identity | Microsoft Entra ID | Login and tokens |
| Email | Provider behind a `MailSender` interface, configured by environment variables | Report and reminder emails |
| WhatsApp | AiSensy behind a `WhatsAppSender` interface | Optional report delivery |
| Secrets | Azure Key Vault | Secrets, injected as environment variables |
| Observability | Application Insights, Sentry | Logs, traces, errors, job monitoring |

```
 Web app / future Android and desktop apps
            |  HTTPS, Bearer token (Entra ID)
            v
   API (NestJS, /api/v1) -----> Azure Storage Queue
            |                        ^
            v                        |
   MongoDB (Cosmos DB vCore)     Worker (queue jobs)
            ^                        |
            |                        +--> Gotenberg (PDF) --> Blob Storage
            +------------------------+--> MailSender / AiSensy
```

## 3. Repository and backend structure

```
dayloop/
  apps/
    api/                      NestJS: main.ts (API) and worker.ts (jobs)
      src/
        common/               guards, decorators, filters, interceptors, pipes
        config/               typed, validated environment configuration
        infrastructure/       mail, whatsapp, storage, pdf, queue, clock (all behind interfaces)
        modules/
          auth/  tenants/  users/  roles/  hierarchy/
          plan-items/  time-logs/  leave/  holidays/
          reports/  notifications/  audit/  entitlements/  platform-admin/
            (each: controller, service, repository, dto, schemas, policies, tests)
    web/                      React app
  packages/
    shared/                   types, validation schemas, permission keys, enums
    api-client/               TypeScript client generated from openapi.yaml
  docs/                       01-PRD.md, 02-architecture.md, api/openapi.yaml, adr/
  .github/                    copilot-instructions.md, prompts/, workflows/
  docker-compose.yml          local MongoDB, Azurite (queue emulator), mail catcher, Gotenberg
```

Rules: a module owns its collections. A module may call another module only through its service interface, never through its repository or collection. Controllers do HTTP only, services hold business rules, repositories do database access only.

## 4. Multi-tenancy

- A tenant is one company. Its Entra tenant id (`tid`) is stored in `tenants.entraTenantId`. A person from another Entra tenant is an external user and needs an invite (PRD 5.1).
- Every collection except the platform ones carries `tenantId`.
- Enforcement in five layers: (1) a `TenantContext` built from the token and kept per request; (2) a base repository that adds `tenantId` to every query and insert; (3) a Mongoose plugin that throws when a query on a tenant collection has no `tenantId`; (4) Super Admin code uses a separate, audited `PlatformRepository`; (5) automated tenant-isolation tests (PRD 7.1).
- The Super Admin lives in the separate `platformAdmins` collection and uses a separate route prefix, `/api/v1/platform`.

## 5. Authentication and authorization

Login and request flow:

1. The client signs in with Entra ID (web: MSAL; mobile and desktop later: authorization code flow with PKCE) and receives an access token for the DayLoop API.
2. The API validates signature, issuer, audience and expiry against Entra's public keys.
3. The API maps (`tid`, `oid`) to a user of the matching tenant. No match, or a deactivated user, means 403. A suspended tenant means 403.
4. A request context is built: `tenantId`, `userId` and effective permissions.

Permission resolution:

- Effective permissions are the union of the user's roles. For the same key the widest scope wins (`own`, `direct`, `subtree`, `tenant`).
- The result is cached in memory in each API instance for 60 seconds, keyed as `authz:{tenantId}:{userId}`. Any change to roles, role assignments or the hierarchy increments `tenants.authzVersion`, which invalidates the cache; other instances pick the change up when their 60-second entry expires. If load grows, the cache moves to a shared store behind a CacheStore interface.
- An endpoint declares `@RequirePermission('plan.view')`. A central `PermissionGuard` is deny-by-default: an endpoint without a decorator is rejected unless it is marked `@Public`.
- A `ScopeResolver` decides whether the actor may act on a target user: `own` means same user, `direct` means target `managerId` is the actor, `subtree` means the actor is in target `ancestorIds`, `tenant` means same tenant.
- The ownership rule (FR-ASSIGN-3) lives in a separate `PlanItemPolicy`: only `createdBy` can edit or delete an item; the assignee can change only status and time logs on an item a manager created.

## 6. Data model

### 6.1 Conventions

- `_id` is an ObjectId. Every tenant document has `tenantId`, `createdAt` and `updatedAt` (UTC). Soft-deletable documents have `deletedAt`. Versioned entities have an integer `version`.
- Local dates are `YYYY-MM-DD` text. Instants are UTC dates.
- Enumerations are strings, defined once in `packages/shared` and validated on input.

### 6.2 Collections

| Collection | Purpose |
| --- | --- |
| `tenants` | Companies: status, Entra tenant, settings, trial info |
| `users` | People: login mapping, roles, manager, ancestors, status |
| `roles` | Configurable roles and their permissions with scopes |
| `planItems` | Plan entries for a user and a date (self-created or assigned) |
| `timeLogs` | Actual work with start and end time |
| `revisions` | Append-only history of every change to versioned entities |
| `comments` | Comments on plan items |
| `leaveRequests` | Leave as a reason plus a date range, with approval state |
| `holidays` | Company holiday calendar |
| `reportTemplates` | Configurable report layout |
| `reportSubscriptions` | Who receives which report, on which channel |
| `dailyReports` | Generated report snapshots |
| `deliveries` | Every email or WhatsApp send, with retry state |
| `auditLogs` | Security and administration events |
| `platformAdmins` | Super Admin accounts (outside tenants) |
| `planDefinitions`, `subscriptions` | Future: plans and tenant subscriptions (model now, build later) |

### 6.3 Schemas

Common fields (`_id`, `tenantId`, `createdAt`, `updatedAt`) are left out below.

```ts
interface Tenant {
  name: string;
  slug: string;
  status: 'trial' | 'active' | 'suspended';
  entraTenantId: string;               // Entra 'tid'
  allowedDomains: string[];
  settings: {
    timezone: string;                  // IANA, e.g. 'Asia/Kolkata'
    weeklyOffDays: number[];           // 0 = Sunday ... 6 = Saturday
    reportTime: string;                // 'HH:mm' in the tenant timezone
    allowExternalUsers: boolean;
    editWindowDays: number;            // back-dated log window, default 7
    overlapPolicy: 'warn' | 'block';   // overlapping time logs
  };
  authzVersion: number;                // bump to invalidate permission caches
  trialEndsAt?: Date;                  // used by plans later
}

interface User {
  name: string;
  email: string;
  login: { type: 'entra' | 'external'; entraObjectId?: string };
  roleIds: ObjectId[];
  managerId?: ObjectId;                // direct manager
  ancestorIds: ObjectId[];             // all managers above, nearest first
  status: 'invited' | 'active' | 'deactivated';
  deletedAt?: Date;
}

interface Role {
  name: string;
  description?: string;
  permissions: { key: string; scope: 'own' | 'direct' | 'subtree' | 'tenant' }[];
  isSystem: boolean;                   // the Admin role cannot be deleted
  version: number;
}

interface PlanItem {
  userId: ObjectId;                    // whose plan it is
  date: string;                        // local date
  title: string;
  description?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  plannedStart?: string;               // 'HH:mm'
  plannedEnd?: string;
  dueDate?: string;
  status: 'planned' | 'in_progress' | 'done' | 'carried_over' | 'dropped';
  createdBy: ObjectId;                 // owner of the content: employee or manager
  origin: 'self' | 'assigned';
  carriedFromId?: ObjectId;
  sortOrder: number;
  version: number;
  deletedAt?: Date;
}

interface TimeLog {
  userId: ObjectId;
  date: string;
  planItemId?: ObjectId;               // empty = unplanned work
  title: string;                       // copied from the item, or typed for unplanned work
  startAt: Date;                       // UTC
  endAt: Date;
  durationMin: number;                 // derived, stored for fast reports
  source: 'timer' | 'manual';
  note?: string;
  version: number;
  deletedAt?: Date;
}

interface Revision {                    // append-only, never updated or deleted
  entityType: 'planItem' | 'timeLog' | 'leaveRequest' | 'reportTemplate' | 'role';
  entityId: ObjectId;
  version: number;
  action: 'create' | 'update' | 'delete' | 'status_change';
  snapshot: Record<string, unknown>;   // full state after the change
  changes: { field: string; from: unknown; to: unknown }[];
  actorId: ObjectId;
  at: Date;
}

interface LeaveRequest {
  userId: ObjectId;
  fromDate: string;                    // inclusive range
  toDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approverId?: ObjectId;               // manager, or Admin as fallback
  decidedAt?: Date;
  decisionComment?: string;
  version: number;
}

interface Holiday { date: string; name: string; }
interface Comment { entityType: 'planItem'; entityId: ObjectId; authorId: ObjectId; body: string; }

interface ReportTemplate {
  name: string;
  isDefault: boolean;
  sections: {
    key: 'leaveStatus' | 'summary' | 'plannedVsDone' | 'timeline' | 'unplanned' | 'tomorrowPlan';
    enabled: boolean;
    order: number;
  }[];
  branding?: { logoUrl?: string; accentColor?: string };
  version: number;
}

interface ReportSubscription {
  recipient: { type: 'user' | 'role' | 'email'; id?: ObjectId; email?: string };
  scope: 'team' | 'tenant';            // team = the recipient's subtree
  channels: ('email' | 'whatsapp')[];
  active: boolean;                     // default: the Admin, whole company, email
}

interface DailyReport {
  date: string;
  scope: 'user' | 'team' | 'tenant';
  subjectUserId?: ObjectId;
  templateId: ObjectId;
  templateVersion: number;
  data: Record<string, unknown>;       // snapshot: day status, plan, logs, tomorrow's plan
  pdfBlobPath?: string;
  status: 'generating' | 'ready' | 'failed';
  idempotencyKey: string;              // unique: tenantId:date:scope:subjectUserId
  generatedAt?: Date;
}

interface Delivery {
  reportId?: ObjectId;
  kind: 'report' | 'reminder';
  channel: 'email' | 'whatsapp';
  to: string;
  status: 'queued' | 'sent' | 'failed';
  attempts: number;
  providerMessageId?: string;
  lastError?: string;
  idempotencyKey: string;              // unique: no duplicate sends
  sentAt?: Date;
}

interface AuditLog {                    // tenantId is the affected tenant
  actorType: 'user' | 'platformAdmin';
  actorId: ObjectId;
  action: string;
  entityType?: string;
  entityId?: ObjectId;
  meta?: Record<string, unknown>;
  ip?: string;
  at: Date;
}

interface PlatformAdmin { name: string; email: string; entraObjectId: string; status: 'active' | 'disabled'; }

// Future scope: modelled now, built later
interface PlanDefinition { key: string; name: string; features: string[]; limits: Record<string, number>; active: boolean; }
interface Subscription { tenantId: ObjectId; planKey: string; status: 'trial' | 'active' | 'expired'; startedAt: Date; endsAt?: Date; }
```

### 6.4 Indexes

Every tenant index starts with `tenantId`.

| Collection | Index | Serves |
| --- | --- | --- |
| `users` | `tenantId, email` (unique) | User lookup, invites |
| `users` | `tenantId, login.entraObjectId` | Token to user mapping |
| `users` | `tenantId, managerId` | Direct reports |
| `users` | `tenantId, ancestorIds` (multikey) | Subtree queries |
| `roles` | `tenantId, name` (unique) | Role lookup |
| `planItems` | `tenantId, userId, date, sortOrder` | Day view |
| `planItems` | `tenantId, date, userId` | Team view and reports |
| `timeLogs` | `tenantId, userId, date, startAt` | Day timeline and overlap check |
| `revisions` | `tenantId, entityType, entityId, version` (unique) | History; prevents duplicate revisions |
| `leaveRequests` | `tenantId, userId, fromDate, toDate` | Day status |
| `leaveRequests` | `tenantId, approverId, status` | Approver inbox |
| `holidays` | `tenantId, date` (unique) | Day status |
| `dailyReports` | `tenantId, idempotencyKey` (unique) | One report per subject and day |
| `deliveries` | `tenantId, idempotencyKey` (unique) | No duplicate sends |
| `deliveries` | `status, createdAt` | Retry and failure monitoring |
| `auditLogs` | `tenantId, at` (descending) | Admin audit view |

## 7. Key flows

### 7.1 Editing a plan item with a revision

1. The client sends `PATCH /api/v1/plan-items/:id` with the `expectedVersion`.
2. `PermissionGuard` checks the permission and `ScopeResolver` checks the scope.
3. `PlanItemPolicy` checks the ownership rule.
4. The service updates the item only if `version` still equals `expectedVersion`, and increments it. A mismatch returns 409.
5. A revision with the new snapshot and the field changes is appended.

The update and its revision should be one transaction. Transaction support has to be verified on the chosen Cosmos DB vCore tier; if it is not available, the revision is written first and the unique index on (`entityId`, `version`) makes a retry safe.

### 7.2 Day status

A `DayStatusService` computes a user's status for a date in this order: holiday, weekly off, approved leave, working day. A pending leave request is shown as a flag. Reminders, the "not planned" warning and the report line all read this one service, so leave is never copied per day.

### 7.3 Time logging

- End must be after start, and neither may be in the future.
- The log must fall inside the edit window (`settings.editWindowDays`).
- An overlap with another log of the same user warns or blocks, per `settings.overlapPolicy`.
- Duration is derived and stored. Each create, edit and delete appends a revision.

### 7.4 Leave

1. The employee submits a reason and a from-to date range.
2. The approver is resolved: the direct manager, otherwise an Admin.
3. The approver approves or rejects with an optional comment. Every step appends a revision.
4. An approved range feeds `DayStatusService`; nothing else is written per day.

### 7.5 Evening report pipeline

1. A scheduled Azure Container Apps job runs every 5 minutes and puts work on the queue. It finds tenants whose local time has passed `settings.reportTime` and that have no report for the local date.
2. For each such tenant it enqueues one `generate-report` job per employee, plus team and company reports according to the active subscriptions.
3. The generator builds the snapshot: day status (including the leave line), planned versus done, timeline, unplanned work, tomorrow's plan. It stores a `dailyReports` document guarded by the unique `idempotencyKey`.
4. HTML is rendered from the tenant's template; Gotenberg converts it to PDF, which is stored in Blob Storage.
5. For each subscription a `deliver-report` job is queued with a unique delivery key. The channel sender sends it, with a growing delay between attempts and up to five attempts, after which the message moves to a poison queue. Failures stay visible in the delivery log.
6. A sent report is never changed; corrections appear in the next day's report.
7. A reminder job runs shortly before report time for employees who have not planned tomorrow. It skips leave days, holidays and weekly offs.

### 7.6 Background jobs and the queue

- The API only puts a job on the queue and returns. It never waits for an email or WhatsApp message to be sent.
- All code uses a `JobQueue` interface. The Phase 1 implementation is Azure Storage Queue; Azure Service Bus can replace it later.
- A message is deleted only after its job succeeds. If the worker crashes, the message reappears after the visibility timeout and is tried again.
- A message can be delivered more than once, so every job must be idempotent. The unique idempotency keys on `dailyReports` and `deliveries` guarantee that nothing is sent twice.
- The worker polls with a growing wait: it checks again at once while the queue is busy, and waits up to 30 seconds when the queue is empty.
- The dequeue count is the retry count. After five failed attempts the message moves to a poison queue, and its size raises an alert.
- Local development uses Azurite, the Azure Storage emulator.

## 8. Notifications

- The core code depends only on `MailSender`, `WhatsAppSender` and a `NotificationChannel` registry. Concrete providers are chosen by environment variables (`MAIL_PROVIDER`) and injected.
- Test and local environments use a mail catcher; WhatsApp is off or sandboxed there (PRD 7.1).
- Adding a channel, such as mobile push later, means adding one implementation.

## 9. Entitlements (Phase 1 hooks for future plans)

- Every module has a feature key: `plans.daily`, `timelogs`, `assignments`, `leave`, `reports.daily`, `roles.custom`, `hierarchy`, `dashboards`, `audit`.
- Controllers use `@RequireFeature('leave')`, which calls `FeatureGate.has(tenantId, key)`.
- In Phase 1 `FeatureGate` returns true for every key (free trial for all). Later it reads `subscriptions` and `planDefinitions`, and the Super Admin console edits them. No module code changes.

## 10. Configuration and deployment

- Azure Container Apps run `api` (scales on HTTP load, at least one replica in production), `worker` (scales on queue length) and `gotenberg` (internal only). The web app runs on Azure Static Web Apps.
- Each environment has its own resource group, database, storage account (queues) and Key Vault. Environments are Local, Dev, Test / QA, Staging and Production (PRD 7.1).
- GitHub Actions builds, tests, scans and pushes one container image, and the same image is promoted from Dev to Production.
- Configuration comes only from environment variables, validated at startup. Names:

Queue hosting: Phase 1 uses Azure Storage Queue, which needs no extra service to run and costs very little, behind the `JobQueue` interface. Redis is not used in Phase 1. If load, retry rules or scheduling needs grow, the interface lets the team move to Azure Service Bus, or add Redis for a shared cache and rate limiting, without changing module code.

```
NODE_ENV, LOG_LEVEL, APP_BASE_URL, CORS_ORIGINS
MONGODB_URI, QUEUE_ACCOUNT_URL, QUEUE_NAME
ENTRA_AUTHORITY, ENTRA_CLIENT_ID, ENTRA_API_AUDIENCE
MAIL_PROVIDER, MAIL_FROM, MAIL_* (provider specific)
AISENSY_API_KEY
GOTENBERG_URL, BLOB_ACCOUNT_URL, BLOB_CONTAINER
APPINSIGHTS_CONNECTION_STRING, SENTRY_DSN
```

## 11. Observability

- Structured JSON logs carry `requestId`, `tenantId` and `userId`, and never tokens or personal data.
- Application Insights for traces and metrics, Sentry for errors, queue length and poison queue size.
- Alerts on failed report jobs, delivery failure rate and API p95 above budget (PRD 7.3).
- Health endpoints: `/health/live` and `/health/ready`.

## 12. Open decisions

1. Transaction support on the chosen Cosmos DB vCore tier (verify before the first write path is built).
2. Email provider and sender address (to be supplied through environment variables).
3. One shared Entra app registration for all companies (recommended), and how a new company's Admin grants consent.
4. Report email: PDF attached or a link to the report in the app.
5. Maximum depth of the hierarchy and maximum team size to design for.
