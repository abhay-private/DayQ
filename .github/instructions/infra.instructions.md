---
applyTo: "infra/**,.github/workflows/**,**/Dockerfile,docker-compose.yml"
---
# Infrastructure and pipeline rules

Follow `docs/05-devops.md` and `docs/04-security.md` (sections 11 and 13). Changes here need a code owner review.

## Containers

- Multi-stage builds, a minimal pinned base image, a non-root user, no dev dependencies in the final image, a health check, a `.dockerignore`, no secrets in layers.
- One image, three entrypoints: `api`, `worker`, `scheduler`. Tag with the commit SHA; never deploy `latest`.

## Pipelines

- Azure access only through OIDC federation with a GitHub Environment per Azure environment. No long-lived Azure keys.
- Workflow permissions are the minimum needed, set explicitly. Pull request builds never receive Dev, Test or Production secrets.
- Third-party actions are pinned to a full commit SHA.
- Required steps follow the workflow table in the DevOps document. Do not remove a test, scan or approval step to make a run pass.
- A configuration check fails the Production deploy when `ENABLE_TEST_TOOLS` is true or `AUTH_ISSUER_MODE` is `mock`, and fails Test / QA when the real mail provider is configured.

## Infrastructure as code (Bicep)

- Modules under `infra/modules`, one folder per environment under `infra/environments`. Names follow `dl-<env>-<resource>`.
- Secrets live in Key Vault and are referenced, never written in templates or parameter files. Use managed identities with the smallest role that works.
- Storage and database accept traffic only from allowed networks. Gotenberg and the worker have no public ingress.
- Run a plan on pull requests; apply only after approval.

## Local stack

- `docker-compose.yml` runs MongoDB, Azurite, a mail catcher, Gotenberg and the mock OIDC issuer. It must work with one command and contain no real secrets.
