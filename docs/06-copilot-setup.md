# How the Copilot files work

| File | Read by | Purpose |
| --- | --- | --- |
| `.github/copilot-instructions.md` | Copilot in every request | Project summary, stack, the rules that are never broken, conventions, how to work |
| `AGENTS.md` | Copilot agent mode and coding agent | Commands, definition of done, always / ask first / never |
| `.github/instructions/*.instructions.md` | Copilot, only for files that match `applyTo` | Detailed rules for backend, frontend, tests, database, infrastructure |
| `.github/prompts/*.prompt.md` | You, on demand in Copilot Chat | Reusable tasks: implement a roadmap task, new module, new endpoint, migration, tests, security review |
| `.github/CODEOWNERS` | GitHub | Required reviewer for security-sensitive paths |
| `.github/pull_request_template.md` | GitHub | Checklist on every pull request |

Tips:

1. Keep `copilot-instructions.md` short. Put detail in the path-specific files and in `docs/`.
2. Give Copilot one small roadmap task at a time, using the `implement-task` prompt.
3. When Copilot repeats a mistake, add one clear line to the right instruction file.
4. Review these files whenever a document changes. They must never disagree with `docs/`.
5. Prompt file front matter keys differ a little between Copilot versions (older versions use `mode` instead of `agent`). If a prompt does not appear, check the current GitHub Copilot documentation for your editor.
