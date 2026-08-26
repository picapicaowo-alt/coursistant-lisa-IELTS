# Contributing to the Coursistant Training Frontend

Read [`AGENTS.md`](./AGENTS.md) and
[`lms/PROJECT_STANDARDS.md`](./lms/PROJECT_STANDARDS.md) before changing code.
They are the current rules; historical architecture notes are reference only.

## Local setup

Use Node 22 or newer. CI installs from `package-lock.json`:

```bash
cd lms
npm ci
npm run dev
```

The frontend repository does not require backend, AI, database, or
infrastructure source code. Use the existing configured integration or the
local mock server when a UI flow needs data.

## Change workflow

1. Start from the latest `main` and keep one product concern per branch.
2. Locate the closest maintained page and copy its established structure.
3. Keep browser requests in `src/apis/services`, contracts in `src/apis/types`,
   page behavior in hooks, and UI in focused components.
4. Add or update tests beside the changed module.
5. Run all required checks from `AGENTS.md` before requesting review.
6. Update documentation when the change establishes a new reusable pattern.

## Hardcoded values

"No hardcoded values" means feature code must not invent or duplicate values
that are owned elsewhere:

- deployment/service locations belong to existing frontend environment keys;
- navigation paths belong to route configuration/helpers when reused;
- roles, statuses, and domain values belong to typed constants/unions;
- colors, spacing, radii, and typography belong to design tokens;
- repeated limits, timeouts, and storage keys belong to named constants;
- credentials and secrets never belong in browser source.

Literal user-facing copy, a one-off semantic HTML attribute, and test fixtures
are not automatically hardcoding. Give a value an owner when it is reused,
environment-dependent, security-sensitive, or meaningful to the domain.

Existing tracked environment and demo-account values are integration inputs.
Do not relocate, rename, sanitize, or replace them unless that exact change is
explicitly requested.

## Comments and documentation

- Comment **why**, not what the next line does.
- Document invariants at the narrowest useful boundary.
- Use TSDoc/JSDoc for exported helpers when their contract is not evident from
  types and naming.
- Link an issue or ADR for compatibility workarounds that outlive one change.
- Delete obsolete comments in the same change that makes them obsolete.

There is no comment quota. Prioritize API contracts, permission sources,
lifecycle and state transitions, optimistic concurrency, idempotency, cache
invalidation, pagination, and compatibility fallbacks when their purpose is not
clear from names and types. Leave straightforward rendering and pass-through
calls uncluttered.

## Styling and UI dependencies

SCSS Modules and the repository design tokens are the default styling path.
MUI or another UI kit may be adopted only through an explicit frontend
architecture decision covering theme/token mapping, shared component ownership,
accessibility, bundle impact, and migration scope. Do not trial a kit through
direct imports scattered across feature pages.

## Dependency and lockfile policy

`package-lock.json` is canonical for CI because CI runs `npm ci`. `yarn.lock` is
retained for team compatibility and must describe the same `package.json`.

- Do not edit either lockfile by hand.
- A dependency change must explain direct and important transitive changes.
- Update both lockfiles together when `package.json` changes.
- A `yarn.lock`-only repair must pass a frozen Yarn install plus the complete
  npm-based quality baseline before merge.

## Pull requests

Use a small imperative title (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`,
or `chore:`). State the user-visible outcome, affected modules, tests run, and
whether any lockfile changed. Never bundle external-system work into a frontend
pull request.
