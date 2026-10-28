---
name: write-tests
description: "Write the missing tests for a file or feature, including security cases"
disable-model-invocation: true
---
Write tests for: [the value I type after the command].

Follow `.github/instructions/tests.instructions.md`.

1. Read the code and the FR-IDs it implements in `docs/01-PRD.md`. List which behaviours are already tested.
2. Add the missing unit tests and, for endpoints, integration tests. Include: denied access, insufficient scope, another company's data, ownership rule, version conflict, invalid input, operator injection in string fields, and duplicate queue delivery where jobs are involved.
3. Put the FR-ID in each test title.
4. Do not change production code to make a test pass without telling me why. If you find a bug, write the failing test, report it, and propose the fix.
5. Run the tests and report coverage for the target.
