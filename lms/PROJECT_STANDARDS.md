# Project Standards

Living coding standards for **coursistant-lisa-IELTS** (training-institution frontend).

These rules started from the university LMS refactor guidelines and apply to
the independent IELTS / training product. Keep the same stack; do not invent
advising APIs that are not in `docs/api/advising.openapi.yaml`.

**Coursistant rule number one:** this repository owns the frontend only. Read
[`../AGENTS.md`](../AGENTS.md) before making changes. A frontend task must not
inspect, edit, deploy, migrate, or claim ownership of backend services, AI
service implementations, databases, or infrastructure. Existing environment,
proxy, and designated demo-account values remain unchanged unless the task
explicitly requests that exact frontend configuration change.

**Authorized working repository:** `https://github.com/picapicaowo-alt/coursistant-lisa-IELTS`

**Related:** `ARCHITECTURE.md`, `STATE_MANAGEMENT.md`, and `API_STANDARDS.md` are historical design notes — prefer this file when they conflict with current code.

---

## 1. Stack (required)

| Layer | Choice |
|-------|--------|
| UI | React 18 functional components + hooks |
| Language | TypeScript (`.ts` / `.tsx`) |
| Build | Vite 7 |
| Server state | TanStack Query (`@tanstack/react-query`) |
| Client / page state | Zustand (+ Immer where stores already use it) |
| HTTP | Axios via `src/apis/api-client.ts` / `v2-api-client.ts` |
| Routing | `react-router-dom` |
| Styles | SCSS modules + design tokens (`src/styles/_tokens.scss`) by default; Tailwind utilities when needed |
| Tests | Vitest + Testing Library |
| i18n | `i18next` / `react-i18next` |

SCSS Modules and the existing design tokens are the default because they match
the current component ownership and visual language. MUI or another UI kit is
not permanently banned, but it must not be introduced piecemeal. Adoption
requires an explicit frontend architecture decision that defines theme/token
mapping, shared wrappers or primitives, accessibility expectations, bundle
impact, and migration scope. Once approved, feature pages consume the shared UI
layer instead of importing a kit ad hoc.

---

## 2. Component structure

### 2.1 Organization

- Prefer **container vs presentational** split for complex pages (logic in hooks/container; UI in focused components).
- One responsibility per component; split when a file owns unrelated flows.
- Page-local pieces stay under that page; shared pieces go in `src/components/`, `src/hooks/`, `src/utils/`.

### 2.2 Reference layouts

Good examples to copy:

- `src/pages/LmsHomePage/` — widgets, page hooks, types, tests
- `src/pages/CourseWorkspacePage/` — store slices, edit/view split, role-aware cards
- `src/pages/RosterPage/` — page hook + row components + SCSS module + tests
- `src/pages/AssignmentDetailPage/` — feature components colocated with tests

### 2.3 Props and composition

- Type props with TypeScript interfaces or type aliases (no PropTypes for new code).
- Prefer composition over inheritance.
- Keep optional props explicit; use `null` when “empty” is a real domain value.

---

## 3. Naming

### 3.1 Files

| Kind | Convention | Example |
|------|------------|---------|
| Components | PascalCase `.tsx` | `MemberRow.tsx` |
| Hooks | `use` + camelCase | `useRoster.ts` |
| Utils | camelCase `.ts` | `submissionState.ts` |
| Styles | `Name.module.scss` | `index.module.scss` |
| Tests | `*.test.ts(x)` next to source | `MemberRow.test.tsx` |
| API services | `*-api.ts` under `apis/services/` | `quiz-api.ts` |
| API types | domain file under `apis/types/` | `assignment.ts` |

### 3.2 Symbols

- Components / types / interfaces: PascalCase
- Functions / variables: camelCase
- Constants: UPPER_SNAKE_CASE when module-level fixed values
- CSS module keys: camelCase in TS; keep selectors readable (avoid one-letter names)

---

## 4. Folder organization

```
src/
├── apis/
│   ├── api-client.ts          # Axios client, refresh, errors
│   ├── v2-api-client.ts
│   ├── services/              # Domain API classes/functions
│   └── types/                 # Request/Response/envelope types
├── pages/
│   └── PageName/
│       ├── components/        # Page-only UI
│       ├── hooks/             # Page-only hooks
│       ├── stores/            # Page Zustand stores (when needed)
│       ├── utils/
│       ├── types.ts | types/
│       ├── index.tsx
│       └── *.module.scss
├── components/                # Shared UI
├── contexts/                  # Auth and other app-wide React context
├── hooks/
├── utils/
├── styles/                    # Tokens and globals
└── types/
```

Legacy folders (`pages/chat`, `pages/profile`, `sections/chat`, …) may still be `.jsx`. **New work must not add `.jsx` / `.js` sources.** When you touch a legacy file for behavior, prefer converting it to `.tsx` in the same change if scope allows.

---

## 5. State management

### 5.1 Choose the right layer

| Need | Use |
|------|-----|
| Server data (lists, detail, mutations) | TanStack Query + `apis/services/*` |
| Auth session | `AuthContext` / existing auth helpers |
| Complex page UI / draft / workspace mode | Zustand store colocated with the page |
| Ephemeral local UI (open/closed, input) | `useState` |

### 5.2 Rules

- Do not call Axios directly from presentational components — go through API services (and usually a hook or query).
- Invalidate or update Query caches after successful mutations that change shared lists.
- Zustand stores that are module singletons must reset or re-key when the route entity changes (see CourseWorkspacePage mode reset on `courseId`).
- Avoid duplicating the same server entity in both Query and Zustand unless there is a clear draft/edit reason.

Historical normalized-store designs in `STATE_MANAGEMENT.md` / `ARCHITECTURE.md` are optional inspiration, not mandatory for every page.

---

## 6. Hardcoded values and configuration ownership

- Do not add environment-specific hosts, ports, credentials, demo values, or
  tokens to feature code.
- Do not duplicate route paths, roles, statuses, storage keys, limits, or other
  domain values across modules. Give repeated/domain-significant values one
  typed owner.
- Use `src/config/env.ts` for typed frontend configuration reads, existing route
  config/helpers for shared paths, and `src/styles/_tokens.scss` for design
  values.
- Do not rename or move existing environment keys/values or demo-account values
  as drive-by hardcode cleanup. They are frozen integration inputs until a task
  explicitly scopes their migration.
- Test fixtures and literal user-facing copy are allowed when they are local to
  the behavior being tested/rendered and are not disguised configuration.

---

## 7. API conventions

### 7.1 Layout

- Contracts: `src/apis/types/*` (`Request` / `Response` naming; mirror LMS v2)
- Calls: `src/apis/services/*`
- Shared envelope: `ApiResponse` in `apis/types` — treat `code === "SUCCESS"` (string), not numeric HTTP-only success
- Writes that the backend supports: send `Idempotency-Key` via the shared helper when the endpoint requires it

### 7.2 Client behavior

- Use the shared `ApiClient` (token attach, refresh coalescing, session-expired callback).
- Prefer relative `/api` in Dev so 8084 same-origin proxy works; do not hardcode secrets or long-lived tokens into the bundle.
- Never log access tokens, refresh material, passwords, or full auth payloads.
- Binary download/preview: use authenticated blob helpers — do not put Bearer tokens in URLs.

### 7.3 Errors and empty states

- Distinguish transport failure vs domain codes (`NOT_FOUND`, empty submission, etc.).
- UI must show recoverable error + retry where the user can act; do not blank the shell.

---

## 8. TypeScript

- New files: `.ts` / `.tsx` only.
- Prefer explicit types on public function params, API payloads, and component props.
- Avoid new `any` and `as any`. If unavoidable at a boundary, narrow ASAP and comment why.
- `tsconfig` is not fully `strict` yet — **new code should still aim for strict-null-safe types** (`strictNullChecks` is on). Production gate: `npm run typecheck:production` (`tsconfig.production.json`, `strict` / `noImplicitAny`, existing quarantine plus leftover v1 shells).
- Do not add `@ts-nocheck` to new files.

---

## 9. Comments and documentation

- Prefer expressive names and types; comments are for constraints that code
  alone cannot explain.
- Explain **why** a workaround, invariant, compatibility branch, or lifecycle
  decision exists. Do not narrate syntax.
- Use concise TSDoc/JSDoc on exported helpers when their contract, side effects,
  error behavior, or ownership boundary is not evident from types.
- Treat permission sources, lifecycle/state transitions, optimistic concurrency,
  idempotency, pagination, cache invalidation, and compatibility fallbacks as
  comment-worthy when the reason is not evident locally.
- There is no target number of comments. Do not add boilerplate documentation
  to obvious pass-through methods merely to increase coverage.
- Keep comments next to the rule they protect, link a durable issue/ADR when
  needed, and remove comments when the constraint disappears.
- Never leave commented-out implementations, change logs, personal notes, or
  TODOs without an owner/reference in production source.

---

## 10. Styling

- Default: SCSS modules next to the component.
- Use design tokens via the injected `t` namespace / CSS variables — do not invent one-off brand colors.
- Tailwind is allowed for layout utilities; do not mix three competing systems in one component without reason.
- A new UI kit needs the architecture decision described in section 1 and a
  shared integration boundary; page-level experimental imports are not allowed.
- Keep interactive affordances keyboard-reachable; do not rely on color alone for state.

---

## 11. Testing

- Colocate `*.test.ts(x)` with the unit under test.
- Prefer Testing Library queries that reflect user behavior.
- Cover: API mappers/clients, role gating, critical mutations, and regression bugs you fixed.
- Run `npm run test:run` before pushing risky UI; keep `npm run build` / `build:dev` green for deployable work.
- Mock network at the API/mock-server boundary for UI tests — do not hit shared Dev DB from unit tests.

---

## 12. Security and privacy

- No credentials, PEM keys, or `.env` secrets in git.
- No shipping hardcoded API tokens or demo passwords in client code.
- Do not alter existing designated demo-account values as unrelated cleanup.
- Strip sensitive bodies from debug logs.
- Course-scoped capabilities beat global role checks for teaching controls when both exist.

---

## 13. Git and repository transition

- During the repository handoff, develop against the configured authorized
  origin. Do not treat `bink44/lms-frontend` or unrelated personal forks as
  upstream.
- Move the remote to `Coursistant-Inc/lms-frontend` only as an explicit
  migration that also verifies access, branch protections, CI, and documentation.
- `main` is the latest production-ready frontend source; do not merge a branch
  that cannot pass the complete frontend quality baseline and production build.
- Prefer small, imperative commit subjects: `feat:`, `fix:`, `test:`, `chore:`.
- Do not commit local QA screenshots (`local-*.png`, `dev-8084-*.png`) unless explicitly requested.
- CI uses `npm ci`, so `package-lock.json` is canonical. Keep the retained
  `yarn.lock` compatible with the same `package.json`; review and verify either
  lockfile whenever it changes.

---

## 14. Dev 8084

- Review UI is built with `npm run build:dev` and deployed as static assets to the Dev host’s `coursistant-review-8084` release layout.
- 8084 is **not** auto-deployed from GitHub. After merge-worthy work, build from this repo and deploy deliberately.
- `/api` on 8084 proxies to the Dev LMS API. Training advising Dev is **8083**;
  university LMS remains 8081. Keep the frontend pointed at same-origin `/api`.

---

## 15. Known gaps (improve when you touch the area)

1. **Legacy JSX** — chat, old roster/notification sections still `.jsx`. Profile and Settings are TSX.
2. **Legacy type quarantine** — these files carry `// @ts-nocheck` until migration: `ChatContent.tsx`, `RichTextEditor/extensions/BlankNode.ts`, `DetailWorkspacePage/index.tsx`, `DetailWorkspacePage/components/AssignmentEdit/index.config.ts`, `stores/core/AggregateRootGenerator.test.ts`.
3. **ESLint** — `npm run lint:ci` (`eslint . --max-warnings=0`) must stay green. Do not leave production-surface issues as warnings.
4. **Typecheck** — `npm run typecheck` and `npm run typecheck:production` in `lms/`.
5. **Dead dependencies** — remove unused UI libraries once confirmed unused.
6. **Docs drift** — update this file when a new vertical establishes a better pattern than the references above.
7. **MathJax transitive warning** — `better-react-mathjax` currently retains a
   `speech-rule-engine@4` path that installs deprecated `@xmldom/xmldom@0.9.10`.
   `npm audit` reports zero vulnerabilities, but upgrade this chain in a
   dedicated dependency change rather than hiding the install warning.

---

## 16. PR / change checklist

- [ ] New UI is `.tsx` with typed props
- [ ] Change is frontend-only; environment/demo integration inputs are unchanged
- [ ] API goes through `apis/services` + typed `apis/types`
- [ ] Loading / empty / error states handled
- [ ] Role or course capability respected
- [ ] Tests added or updated for the behavior change
- [ ] No secrets in logs or bundle
- [ ] No new hardcoded deploy/domain/design value; comments explain only non-obvious constraints
- [ ] Any lockfile change was reviewed and verified
- [ ] Styles use modules/tokens (no new ad-hoc global CSS dumps)
