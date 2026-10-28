---
applyTo: "apps/web/**"
---
# Frontend rules (React web app)

Follow `docs/01-PRD.md` (screens come from the functional requirements), `docs/03-api-spec.md` and, when it exists, `docs/09-ui-ux-spec.md` for design tokens, components and flows.

## Structure

- `src/features/<feature>/` holds pages, components, hooks and tests for one feature (plan, time-log, leave, reports, team, admin, platform). `src/components/ui/` holds shared shadcn/ui based components. `src/lib/` holds the API client setup, auth and utilities.
- One component per file, PascalCase names. Hooks start with `use`. No business rules in components: the API is the authority.

## Data and API

- Call the API only through the generated client in `packages/api-client`. Do not write `fetch` calls to the API by hand.
- Server state uses TanStack Query (query keys per resource, invalidate after mutations). Do not copy server data into global state.
- Forms use react-hook-form with the Zod schemas from `packages/shared`, so validation matches the backend.
- Handle the error `code` from problem details (for example `VERSION_CONFLICT` shows a reload prompt), never the message text.
- Dates: show calendar dates and times in the company time zone; send `YYYY-MM-DD` and UTC instants as in the API specification.

## Auth and permissions

- Sign in with MSAL (authorization code flow with PKCE). Keep tokens in memory or session storage, never `localStorage`. Never log tokens or put them in URLs.
- Read the user's roles, effective permissions and feature flags from `GET /me`. Use them to show or hide navigation and actions. This is for usability only; the server enforces every rule.
- The ownership rule shows in the UI: items created by a manager carry a badge and have no edit or delete action for the employee (status and time logging stay available), and the reverse.

## UX quality

- Every screen has loading, empty, error and no-permission states.
- The interface must feel modern, positive and fast: optimistic updates where safe, skeleton loaders, clear feedback, keyboard support, visible focus, WCAG AA contrast, responsive from phone to desktop.
- No hardcoded colours, spacing or fonts. Use the Tailwind theme and design tokens. Until `docs/09-ui-ux-spec.md` exists, keep tokens in one theme file so the look can change in one place.
- Day Timeline (planned versus actual on a time axis) and leave or holiday banners are core views; design them first-class, not as afterthoughts.

## Security and performance

- Render user text as text. No `dangerouslySetInnerHTML` on user content.
- Lazy-load routes, split code, avoid large dependencies, memoise only where profiling shows a need.
- Test components with Testing Library; test critical journeys with Playwright.
