# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

X-Learn serves students and the staff who operate an independent language-training institution. The live frontend also supports instructors, advisors, counsellors, parents, tenant administrators, and system administrators through role-gated workflows. These roles and jobs are derived from the repository's current routes and contracts rather than invented for the redesign.

## Product Purpose

The product brings course delivery, study planning, assessment, advising, learning operations, and AI-assisted study support into one browser application. Success means each role can see the work relevant to them, understand its state, and complete the next action without losing the record-driven workflow already implemented.

## Positioning

X-Learn is the independent training-institution product for IELTS, GRE, and TOEFL operations. Its differentiator is the connection between day-to-day learning activity and institution-managed advising, delivery, and assessment records; it is not the university LMS product from which the frontend was originally forked.

## Operating Context

Students use the product to learn, review courses and study plans, sit assessments, track progress, and request support. Staff use it to manage courses, assignments, quizzes, grading, student intake and advising records, mock exams, schedules, and operational follow-up. The product is used on desktop and mobile web, with protected workflows backed by external frontend-consumed APIs.

## Capabilities and Constraints

- React 18, TypeScript, Vite, TanStack Query, Zustand, and SCSS Modules are the maintained frontend stack.
- This repository owns the browser frontend only. Backend services, databases, infrastructure, and their source repositories remain external integration boundaries.
- Existing routes, role gates, business copy, and API contracts are product truth during the UI redesign.
- Gate C course orchestration remains unwired until separately authorized.
- Credentials, fixture passwords, and environment-specific values must not enter the design system or committed source.

## Brand Commitments

The product name is X-Learn. The visual authority for the implemented Student Dashboard is the accessible Figma file `qBAAByIXGNIpoOcilCYISR`, node `17:914` (`Dashborad/student`), a 1440×1024 frame inspected exactly after Dev-seat access. Its calm white operational canvas, softly tinted navigation, purple identity, HarmonyOS Sans TC typography, compact information density, and Student dashboard composition are binding. The redesign must be expressed as reusable semantic tokens and components rather than page-local color patches.

## Evidence on Hand

- Authoritative Student Dashboard: `https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning?node-id=17-914`
- Frontend product and engineering standards: `AGENTS.md` and `lms/PROJECT_STANDARDS.md`
- Current role, route, and workflow evidence: `lms/src/App.tsx`, `lms/src/configs/routes.config.ts`, and `docs/api/*.openapi.yaml`
- Existing browser assets: `lms/public/icons/`

No testimonials, commercial benchmarks, institutional claims, or backend capabilities should be invented as part of the UI work.

## Product Principles

1. Preserve functional, record-driven workflows while replacing the visual system.
2. Make role and next action legible before adding visual flourish.
3. Keep external contracts explicit and frontend-only ownership intact.
4. Use one semantic design system across authentication, app shell, workspaces, and responsive states.
5. Treat accessibility, real loading/error/empty states, and mobile behavior as part of the designed product.

## Accessibility & Inclusion

The frontend should meet WCAG 2.2 AA interaction expectations: keyboard-operable controls, visible focus, readable contrast, semantic status/error communication, motion reduction, and responsive layouts that remain usable at narrow mobile widths and browser zoom.
