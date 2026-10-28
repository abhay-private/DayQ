---
description: Add a safe, backward-compatible database migration with a test
agent: agent
---
Add a migration for: ${input:change:What changes, for example add index on planItems (tenantId, date, userId)}.

Follow `docs/05-devops.md` section 5 and `.github/instructions/database.instructions.md`.

1. Check the change against `docs/02-architecture.md` section 6. If the schema or index is not in the document, stop and ask me; the document changes first.
2. Create `apps/api/migrations/<timestamp>-<short-name>` with `up` and, where possible, `down`.
3. Use expand-then-contract: the previous version of the app must keep working after this migration runs. If the change removes or renames something, split it into two releases and tell me.
4. Indexes start with `tenantId`. Create them here, not at application start.
5. Write a test that runs the migration against the seed data and checks the result and that it can run twice safely.
6. Summarise the risk and the rollback steps.
