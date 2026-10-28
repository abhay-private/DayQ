# DayLoop documents

Put the exported Markdown files here with these names. Copilot reads them, so keep them in step with the code.

| File | Document | Answers |
| --- | --- | --- |
| `01-PRD.md` | PRD and Roles and Permission Matrix | What are we building, who can do what, what is in Phase 1 |
| `02-architecture.md` | System Architecture and Data Model | How is it built, collections, indexes, flows, queue |
| `03-api-spec.md` | API Specification | Endpoints, conventions, error codes |
| `api/openapi.yaml` | Generated OpenAPI file | Machine-readable API contract (generated, never edited by hand) |
| `api/CHANGELOG.md` | API changelog | What changed in the API |
| `04-security.md` | Security and Authentication | Login, token checks, authorization, isolation, data protection |
| `05-devops.md` | DevOps and Environments | Environments, Azure resources, pipelines, configuration |
| `06-copilot-setup.md` | How the Copilot files work | Optional note for the team |
| `07-implementation-roadmap.md` | Implementation roadmap | Milestones and small tasks (to be written) |
| `08-report-notification-spec.md` | Report and Notification Spec | Report layout, templates, reminders (to be written) |
| `09-ui-ux-spec.md` | UI/UX Spec | Design tokens, screens, flows (to be written) |
| `adr/` | Architecture decision records | Why a decision was made |
| `runbooks/` | Runbooks | Operational procedures |

Rules for changing documents:

1. Change the document first when a requirement changes, then the code.
2. Export again to Markdown and commit the document in the same pull request as the code.
3. Never leave a document and the code disagreeing.
