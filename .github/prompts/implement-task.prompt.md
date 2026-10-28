---
description: Implement one DayLoop roadmap task test-first, following the project documents
agent: agent
---
Implement roadmap task ${input:taskId:Task id, for example M2-T05} from `docs/07-implementation-roadmap.md`.

If that file or task does not exist, ask me to describe the task and the FR-IDs it covers before doing anything.

Follow `.github/copilot-instructions.md` and `AGENTS.md`. Work in this order:

1. Restate the task, the FR-IDs it covers and the documents sections that apply.
2. List the files you will add or change and the tests you will write. Wait for my approval if the plan touches auth, permissions, tenant context, schemas, indexes or infrastructure.
3. Write the failing tests first (unit, and integration for endpoints): success, validation failure, unauthenticated, missing permission, insufficient scope, another company's object, and ownership where relevant.
4. Implement the smallest change that makes the tests pass.
5. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:int`. Fix every failure.
6. Update the OpenAPI output and `docs/api/CHANGELOG.md` when the API changed.
7. Finish with a short summary: what changed, assumptions, open questions, and any document text that should change.

Do one task only. Do not refactor unrelated code.
