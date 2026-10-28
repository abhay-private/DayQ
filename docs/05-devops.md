# DayLoop – DevOps and Environments (v0.1)

This document describes how DayLoop is built, tested, deployed and operated on Azure: environments, Azure resources, containers, pipelines, configuration, the Test / QA environment that anyone can use, monitoring, backups and the first setup steps. It builds on the PRD, the System Architecture, the API Specification and the Security document (all v0.1).

## 1. Principles

1. **Everything is automated.** Build, test, scan, deploy and infrastructure changes run from GitHub Actions. Nobody deploys by hand from a laptop.
2. **Build once, promote the same image.** One container image per commit moves from Dev to Test / QA to Production. Only configuration differs.
3. **Configuration comes from environment variables**, validated at startup, with secrets in Key Vault.
4. **Environments are isolated.** Separate resource groups, databases, queues, identities and Entra app registrations. No real customer data outside Production.
5. **Tests gate every step.** A red pipeline stops the release (PRD 7.1).
6. **Infrastructure is code**, reviewed like application code.
7. **Cost is controlled.** Non-production environments scale to zero when idle and have budgets and alerts.

## 2. Environments

| Environment | Purpose | Runs on | Data | Sign-in | Email and WhatsApp | Deploys when |
| --- | --- | --- | --- | --- | --- | --- |
| Local | Developer machine | docker compose: MongoDB, Azurite, mail catcher, Gotenberg, mock OIDC issuer | Seed script | Mock OIDC issuer | Mail catcher only | By the developer |
| CI | Automated tests on every pull request | GitHub Actions service containers | Fresh seed per run | Mock OIDC issuer | Mail catcher | Every pull request |
| Dev | Latest main branch for developers | Azure Container Apps, scales to zero | Seed data | Entra test tenant | Sandbox inbox | Automatically after merge to main |
| Test / QA | Stable place for anyone to test a release candidate | Azure Container Apps | Demo companies, reset nightly and on demand | Entra test tenant, one account per role | Sandbox inbox; WhatsApp off or sandbox | Manual promotion of the Dev image |
| Staging | Production-like rehearsal, added before the first outside client | Same size as Production | Synthetic | Entra test tenant | Allow-listed test recipients only | Manual promotion |
| Production | Live | Azure Container Apps, at least one API replica | Real | Each company's own Entra tenant | Real | Manual approval |

The mock OIDC issuer exists only in Local and CI so automated tests do not depend on Microsoft. The API refuses to start with the mock issuer when `NODE_ENV` is Production or Staging.

## 3. Azure resources per environment

Naming: `dl-<env>-<resource>`, for example `dl-prod-api`. Environment short names: `dev`, `test`, `stg`, `prod`. The region is an open decision (Security section 18); all production resources use the same one.

| Resource | Use | Notes |
| --- | --- | --- |
| Resource group | One per environment | Access is granted per group |
| Container Apps environment | Hosts `api`, `worker`, `gotenberg`, the scheduler job and, in Test / QA, a mail catcher | One per environment |
| Container app `api` | REST API, serves `/docs` in Dev and Test / QA only | External HTTPS ingress |
| Container app `worker` | Reads the job queue | No ingress |
| Container app `gotenberg` | HTML to PDF | Internal ingress only |
| Container Apps job `scheduler` | Cron `*/5 * * * *`, queues report and reminder work (Architecture 7.5) | Same image as the API, different command |
| Static Web App | The React web app | Custom domain and managed certificate |
| Cosmos DB for MongoDB vCore | System of record | Production has its own cluster. Dev and Test / QA may share one small cluster with separate databases to save cost |
| Storage account | Queues `jobs` and `jobs-poison`; private blob container `reports` | Blob soft delete on |
| Key Vault | Secrets | Soft delete and purge protection on |
| Application Insights and Log Analytics workspace | Logs, traces, metrics, alerts | Retention limited per environment to control cost |
| Container Registry | Images tagged with the commit SHA | One registry shared by all environments |
| Managed identities | One for the API, one for the worker and scheduler | Least privilege roles (Security section 11) |

## 4. Containers and runtime

- **One image, two entrypoints:** `api` runs `main.js`, `worker` runs `worker.js`, `scheduler` runs `scheduler.js`. All come from the same build.
- **Dockerfile rules:** multi-stage build, minimal pinned base image, non-root user, no dev dependencies in the final image, `.dockerignore`, health check, no secrets in layers.
- **Tags:** the commit SHA. `latest` is never deployed.
- **Scaling:** `api` scales on concurrent HTTP requests (minimum 0 in Dev and Test / QA, at least 1 in Production). `worker` scales on the queue length (KEDA queue scaler built into Container Apps), 0 to a few replicas.
- **Health:** `/health/live` and `/health/ready` are used for probes. `ready` checks the database and the queue.
- **Gotenberg:** internal only. Its URL allow and deny lists are configured to refuse everything except the local content the API sends; confirm the exact option names in the Gotenberg documentation. A custom virtual network with outbound rules is the stronger option and is an open decision.
- **Revisions:** every deploy creates a new Container Apps revision. Traffic moves to the new revision after its health check passes. Rollback means sending traffic back to the previous revision.

## 5. Database changes

- Schema changes are versioned migration scripts in `apps/api/migrations`, run by a pipeline step before the new revision gets traffic.
- Indexes are created by migrations, never automatically at application start in Test / QA, Staging or Production.
- **Expand, then contract:** a migration must keep the previous version of the app working. Add the new field or index first, deploy the code, and remove the old field in a later release. This keeps rollback safe.
- Each migration has a test that runs it against the seed data.

## 6. Branching and release

- **Trunk-based:** short-lived branches (`feature/<ticket>-<name>`, `fix/...`) merged into `main` through pull requests. `main` is always releasable.
- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- **Pull request template:** what changed, which FR-IDs, tests added, the security checklist from Security section 17, API changelog updated.
- **Versions:** semantic versions as Git tags (`v0.1.0`). The release notes come from the API changelog and the commit messages.
- **Unfinished work:** hidden behind feature keys, so `main` can always be deployed.
- **Hotfix:** branch from the production tag, fix with a test, run the same pipeline, deploy with approval, merge back to `main`.

## 7. Pipelines (GitHub Actions)

| Workflow | Trigger | Steps |
| --- | --- | --- |
| `pr` | Pull request | Install, lint, type check, unit tests, integration tests with service containers, OpenAPI generation and diff check, contract tests, build, dependency scan, CodeQL, secret scan, end-to-end smoke tests |
| `main` | Merge to `main` | Build the image, container scan, push to the registry, run migrations on Dev, deploy to Dev, smoke test |
| `release-test` | Manual, or a release tag | Promote the image to Test / QA, run migrations, reset seed data, run the full end-to-end suite |
| `release-prod` | Manual, with approval | Check that the image passed Test / QA, take the approval from the GitHub Environment, run migrations, deploy, smoke test, move traffic. Roll back on a failed smoke test |
| `nightly` | Schedule | Full end-to-end and security suites on Test / QA, ZAP baseline scan, dependency and image scans, Test / QA reset |
| `infra` | Changes under `infra/` | Plan on pull request, apply on merge with approval |

- Azure access uses OIDC federation from GitHub, with a separate federated credential and GitHub Environment for each Azure environment. No long-lived Azure keys are stored in GitHub.
- Pull request builds from forks and branches never get access to Dev, Test / QA or Production secrets.
- Required status checks on `main`: the whole `pr` workflow.

## 8. Configuration and secrets

- `.env.example` in the repository lists every variable with a safe example value. The real values live in Key Vault (secrets) or the Container Apps configuration (non-secrets).
- The application validates all variables at startup and refuses to start if one is missing or invalid.
- Variables (names only):

```
NODE_ENV, LOG_LEVEL, APP_BASE_URL, CORS_ORIGINS
AUTH_ISSUER_MODE (entra or mock), ENTRA_AUTHORITY, ENTRA_CLIENT_ID, ENTRA_API_AUDIENCE
MONGODB_URI
QUEUE_ACCOUNT_URL, QUEUE_NAME, QUEUE_POISON_NAME
BLOB_ACCOUNT_URL, BLOB_CONTAINER
GOTENBERG_URL
MAIL_PROVIDER, MAIL_FROM, MAIL_* (provider specific)
AISENSY_API_KEY
ENABLE_TEST_TOOLS
APPINSIGHTS_CONNECTION_STRING, SENTRY_DSN
```

| Setting | Local and CI | Dev | Test / QA | Production |
| --- | --- | --- | --- | --- |
| `AUTH_ISSUER_MODE` | mock | entra | entra | entra |
| `ENABLE_TEST_TOOLS` | true | true | true | false (CI fails otherwise) |
| `/docs` API documentation | on | on | on | off |
| Mail provider | mail catcher | sandbox | sandbox | real provider |
| WhatsApp | off | off | off or sandbox | AiSensy, per company opt-in |
| Log level | debug | debug | info | info |
| Minimum API replicas | n/a | 0 | 0 | 1 or more |

The mail provider, its credentials and the sender address are supplied by the product owner as environment values.

## 9. The Test / QA environment

The goal: anyone who needs to test DayLoop can do it without setup, without risk and without affecting real people.

- **Access:** its own web address, API, API documentation at `/docs`, and a mail inbox web page where all outgoing emails can be read.
- **Accounts:** a separate Entra test tenant with one account per role (Admin, Manager, Employee, Management, an external guest). Testers are invited to that tenant. A Super Admin test account exists for the platform console. Credentials are kept in a password manager or Key Vault, never in the repository.
- **Seed data:** two demo companies, about 30 users, a three-level hierarchy, plans, time logs, approved and pending leave, holidays and past reports (PRD 7.1).
- **Reset:** nightly at a fixed time and on demand with `/test/reset`. The environment page shows the last reset time.
- **Test helpers:** run the evening report now, set the simulated date for leave and holiday scenarios. These exist only with `ENABLE_TEST_TOOLS=true`.
- **Safe notifications:** email goes only to the sandbox inbox; WhatsApp is off or sandboxed. A configuration check in the pipeline refuses to deploy Test / QA with the real mail provider.
- **Release candidates:** a build reaches Test / QA only after the `pr` and `main` workflows are green. The release is signed off with a checklist: the full end-to-end run is green, the manual scenarios of the release were tried, no open high-severity bug.
- **Bug reports:** a template with environment, build version, role used, steps, expected and actual result, and the request id shown in the error.

## 10. Monitoring and alerts

- Application Insights for traces and metrics, Log Analytics for logs, Sentry for errors, an external uptime check on `/health/live`. Logs follow the rules in Security section 12.
- Dashboards: API latency and errors, queue length and age, poison queue size, reports generated and delivered per day, active users per company.

| Alert | Condition | Action |
| --- | --- | --- |
| API down | Health check fails 3 times in 5 minutes | Notify the owner at once |
| API errors | Server errors above 2 percent for 5 minutes | Notify |
| Slow API | p95 above 300 ms for 15 minutes | Notify |
| Report missing | No report for a company 30 minutes after its report time | Notify |
| Poison queue | Any message in `jobs-poison` | Notify |
| Queue backlog | Oldest message older than 10 minutes | Notify |
| Delivery failures | More than 5 percent failed in an hour | Notify |
| Login anomalies | Spike of 401 or 403 responses, or Super Admin access outside normal use | Notify |
| Budget | 80 percent of the monthly budget | Notify |
| Expiry | Secret or certificate expires within 30 days | Notify |

## 11. Runbooks

Short, tested procedures kept in `docs/runbooks/`:

1. Roll back a deployment (move traffic to the previous revision, check migrations).
2. A company did not receive its report (check the scheduler, queue, poison queue, delivery log, resend).
3. The queue is stuck or growing (worker health, poison messages, scale rule).
4. Restore the database from backup.
5. Rotate a secret.
6. Onboard a new company (Security 3.2).
7. Suspend or reactivate a company.
8. Reset Test / QA.
9. Security incident (Security section 16).

## 12. Backup and recovery

- Cosmos DB backup and point-in-time restore enabled for Production; verify what the chosen tier offers and its retention.
- Blob soft delete and versioning for report files; Key Vault soft delete and purge protection.
- A restore drill is done once before go-live and then every six months. The result is recorded.
- Proposed targets for Phase 1 (to confirm): data loss of at most 24 hours (RPO) and service back within 4 hours (RTO).
- Infrastructure can be recreated from the `infra/` code; application data comes from the backup.

## 13. Infrastructure as code

- Recommended: Bicep, because the setup is Azure-only and needs no separate state file. Terraform is a fine alternative if the team prefers it.
- Layout: `infra/modules` (container apps, cosmos, storage, key vault, monitoring) and `infra/environments/dev|test|stg|prod`.
- Entra app registrations are created by a script (Azure CLI or Microsoft Graph) kept in `infra/identity`, so every environment gets the same setup (Security 3.1).
- Changes go through pull requests: plan on the pull request, apply after approval.

## 14. Cost control

- Dev and Test / QA scale to zero when idle; the API's first request after idle is slower, which is acceptable there.
- Dev and Test / QA share one small database cluster with separate databases, if the isolation is acceptable.
- Staging is added only before the first outside client.
- Limit log retention and sampling in non-production.
- Budgets with alerts on every resource group. Review the monthly bill during Phase 1 to see the real cost of each resource before adding more.

## 15. Phase 0 setup checklist

These steps need no further documents and can start now:

1. Create the GitHub repository from the structure in Architecture section 3. Turn on branch protection, required reviews, secret scanning, Dependabot and CodeQL.
2. Create the Azure subscription structure: one resource group per environment (start with Dev and Test / QA), a shared Container Registry, budgets and alerts.
3. Create the Entra test tenant and the app registrations for Dev (`dayloop-api`, `dayloop-web`) as in Security section 3.1.
4. Create the Dev resources: storage account with the queues and the blob container, Cosmos DB database, Key Vault, Container Apps environment, Application Insights, Static Web App.
5. Set up GitHub OIDC federation to Azure and the GitHub Environments.
6. Write `docker-compose.yml` for Local with MongoDB, Azurite, the mail catcher, Gotenberg and the mock OIDC issuer.
7. Create the first pipelines: `pr` (lint, type check, one test) and `main` (build, push, deploy a health-check-only API to Dev).
8. Check that the Dev API's `/health/ready` and a Microsoft login against Dev work end to end.

## 16. Open decisions

1. When to add Staging (proposed: before the first outside client).
2. Whether Dev and Test / QA share one database cluster.
3. Bicep or Terraform (proposed: Bicep).
4. Azure region, and the domain name for the web app and API.
5. How to block outbound internet for Gotenberg: its own URL lists only, or a custom virtual network.
6. Mail catcher for Test / QA (for example Mailpit) and how it is protected.
7. Recovery targets (24 hours and 4 hours proposed).
8. How testers receive access to the Entra test tenant.
