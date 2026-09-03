# Coursistant Training Frontend Rules

These rules apply to the entire repository and to humans, coding agents, and
automation working in it.

This is the **independent training-institution product** (IELTS / GRE / TOEFL
operations). It was forked from the university LMS frontend and keeps the same
stack and ownership boundary. It is not a drop-in replacement for
`picapicaowo-alt/coursistant-lisa`.

## Rule 1: this repository owns the frontend only

- This repository owns the browser application: React components, TypeScript
  types, frontend state, styling, accessibility, frontend tests, and frontend
  build configuration.
- Do not inspect, edit, deploy, migrate, or claim ownership of backend services,
  AI service implementations, databases, infrastructure, or their source
  repositories from a frontend task.
- Do not change tracked environment values, proxy targets, or designated demo
  account values unless the task explicitly names that frontend value as its
  scope. They are integration inputs, not opportunistic cleanup targets.
- When a frontend change exposes an external contract problem, record the
  expected/observed behavior for handoff. Do not repair the external system.
- Do not invent endpoints, fields, or error codes that are not in the consumed
  OpenAPI. Gate C course orchestration stays unwired until Promotion C is
  authorized.
- Never commit credentials, fixture passwords, or Dev account values.

## Repository ownership

- Authorized working repository: `picapicaowo-alt/coursistant-lisa-IELTS`.
- App root: `lms/`.
- Follow `lms/PROJECT_STANDARDS.md`. Historical university LMS documents never
  override the live code and that standard.
- Frontend-consumed contracts live in `docs/`. `docs/api/advising.openapi.yaml`
  is the unique advising contract.

## Implementation rules

- Follow the existing React 18 + TypeScript + Vite architecture before adding a
  new abstraction or dependency.
- New production modules are `.ts`/`.tsx`. Keep page-only code with its page;
  promote code to shared folders only after it has a real shared consumer.
- Components render UI. Hooks coordinate behavior. API services own browser
  requests. TanStack Query owns server state; Zustand owns complex client/page
  state; `useState` owns local transient state.
- SCSS Modules and the existing design tokens are the default styling path.
  The user-supplied Figma frames and exports are the visual authority where
  available; retain their composition, interactions and semantic status colors.
  Use `docs/final-figma-review-2026-09-03.md` for the frame/API mapping and known
  gaps. MUI or another UI kit requires an explicit frontend architecture decision.
- Pages without a direct Figma frame use a responsive 12-column desktop grid,
  with primary and supporting regions (such as 8+4 or 7+5). Collapse deliberately
  at smaller breakpoints. Do not default to a narrow centered stack or append
  unrelated feature workspaces below a Dashboard; keep their navigation and
  routes complete. Preserve useful whitespace rather than filling it with
  invented data, nested cards or duplicate shells.
- Verify visible controls through their actual frontend behavior and consumed
  API contract. Record unsupported features and live-access gaps explicitly;
  fixture tests, screenshots and successful builds are separate evidence from
  authenticated live acceptance. Keep reserved AI UI honest about readiness.
- Do not add deploy-specific URLs, credentials, demo values, duplicated route
  strings, role/status strings, or design colors directly in feature code.
- Comments explain constraints, invariants, compatibility decisions, and the
  reason behind non-obvious code.
- Never add `any`, `as any`, `@ts-nocheck`, ignored lint errors, secrets, or
  production `console.log` calls to avoid doing the real work.

## Required checks

From `lms/`, run the checks proportionate to the change. Before merging a
production-facing change, the complete baseline is:

```bash
npm run lint:ci
npm run typecheck
npm run typecheck:production
npm run test:run
npm run build
npm run test:e2e
```

Do not merge with a failing check or unexplained lockfile change.
