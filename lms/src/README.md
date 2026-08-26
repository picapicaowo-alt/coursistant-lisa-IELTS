# Frontend Module Map

This directory contains the browser application. Start with the existing
vertical that most closely matches the work instead of creating a parallel
architecture.

| Area | Responsibility |
|------|----------------|
| `main.tsx` | Application boot and top-level providers |
| `App.tsx` | Lazy route composition and authenticated/public shells |
| `pages/CounsellorDashboardPage` and advising verticals | Counsellor / Advisor / Student / Tenant intake and profile-plan surfaces (Gates A/B) |
| `components/` | Reusable UI with more than one real consumer |
| `apis/services/` | Browser request functions grouped by product domain |
| `apis/types/` | Typed request/response contracts consumed by the frontend |
| `apis/api-client.ts` | Shared HTTP, authentication recovery, and error behavior |
| `config/` | Read-only frontend configuration boundary |
| `contexts/` | App-wide React context, currently authentication/session concerns |
| `providers/` | Root library providers such as TanStack Query |
| `hooks/` | Reusable React behavior without page-specific rendering |
| `stores/` | Shared or complex client-side state; server data stays in TanStack Query |
| `styles/` | Global styles and design tokens |
| `utils/` | Pure reusable helpers without React or network ownership |

## Adding a feature

1. Add the route lazily in `App.tsx` when a new page is required.
2. Create the page under `pages/PageName/`; colocate page-only code and tests.
3. Put frontend contracts in `apis/types/` and browser calls in
   `apis/services/`. Components must not call Axios directly.
4. Use TanStack Query for server state, a page hook for orchestration, and
   focused components for rendering.
5. Promote a helper/component to a shared folder only after a second consumer
   proves the shared abstraction.

See [`../PROJECT_STANDARDS.md`](../PROJECT_STANDARDS.md) for the complete rules.
