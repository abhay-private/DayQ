---
name: new-module
description: "Scaffold a new backend module (controller, service, repository, policy, DTOs, tests) the DayLoop way"
disable-model-invocation: true
---
Create the backend module `[the value I type after the command]` in `apps/api/src/modules/`.

Use `docs/02-architecture.md` (sections 3 and 6) and `.github/instructions/backend.instructions.md`.

Create:
- `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts` (extends the base repository, so `tenantId` is always applied), a `*.policy.ts` only if the module has ownership or state rules, `dto/` built from Zod schemas in `packages/shared`, `schemas/` matching the architecture document exactly.
- A feature key for the module in `packages/shared` and `@RequireFeature` on its controller.
- Failing spec files first: one for the service and one for the repository (using the integration test setup).

Do not add endpoints beyond what `docs/03-api-spec.md` lists for this module. Do not import another module's repository; depend on its service interface. List anything the documents do not specify as an open question instead of guessing.
