# Coursistant Frontend Takeover Status

> Historical USC LMS handoff record only. Its 8084 deployment remains reserved for USC. The independent IELTS frontend uses Dev 8085; do not use this file as its live deployment guide.

Updated: 2026-08-24

This repository is a continuation of the existing React + TypeScript LMS frontend. The takeover work preserves the original application and incrementally replaces incomplete or legacy flows with the current LMS v2 contracts on backend port 8081.

## Completed in the takeover

### Application and authentication baseline

- Restored missing TipTap dependencies so production builds succeed.
- Corrected multipart requests so the browser supplies valid upload boundaries.
- Added transparent access-token refresh with concurrent refresh coalescing.
- Added server logout before local-session cleanup.
- Kept the Figma login experience to one email/password form while transparently resolving USER and platform-admin account tables required by the current backend contract.
- Replaced the legacy signup shell with the current two-step email-verification registration contract; a successful registration stores the issued session and enters the student Dashboard directly.
- Added client-side registration validation that matches the backend password/code rules, resend countdown and rate-limit feedback, accessible labels/status messages, and responsive mobile layout.
- Removed the now-unreachable social-signup route and OAuth callback routes because the backend exposes no social registration contract.
- Fixed the 8084 login outage: the Dev backend accepted the CORS preflight but rejected the real cross-port POST with `403 Invalid CORS request`; the review deployment now sends auth and business API requests through a same-origin 8084 `/api` proxy.
- Prevented anonymous login failures from refreshing an unrelated previous session, removed stale legacy-account redirects, and routed platform admins to the global Courses view.
- Removed sensitive request/response bodies from development logs.
- Removed dead social sign-in/sign-up buttons and the legacy standalone Chat route; neither had a current backend contract, and the old Chat bundle referenced retired endpoints.
- Fixed the protected-route refresh race that redirected valid sessions to `/login`.
- Added page-level error boundaries so one failed route does not blank the entire shell.
- Kept the global Dashboard/sidebar/header shell visible on nested course, assignment, quiz, and notification routes.
- Replaced course `navigate(-1)` history loops with a deterministic Back to Dashboard action.
- Normalized public backend avatar URLs to the configured API origin, including the dev `:8081` port, while leaving external avatar hosts unchanged.

### Assignment vertical slice

- Added typed LMS v2 assignment contracts and API methods.
- Added role-shaped assignment detail for students and staff.
- Added student staging-file upload, removal, confirmation, and idempotent submission.
- Treat the live API's `404 NOT_FOUND / No formal submission yet` response as a valid empty submission state, while preserving retry UI for real request failures.
- Added instructor assignment creation, editing, attachment upload, and publishing.
- Added a recoverable assignment checkpoint: once the assignment record is created, attachment or publish retries reuse the same assignment ID and do not re-upload attachments that already succeeded.
- Added instructor grading roster, search/filter, score and feedback entry, and grade release.
- Added course-detail entry points for assignment creation, editing, and grading.
- Added safe feedback escaping before HTML is sent to the grading API.

### Notifications

- Added the authenticated notification inbox and unread-count APIs.
- Added a header notification bell with polling, unread badge, paged inbox, and loading/error/empty states.
- Added idempotent single-read and mark-all-read operations.
- Decoupled read state from navigation: Mark all read now changes only the read indicator, and every still-available notification remains mouse- and keyboard-navigable afterwards.
- Disabled navigation for `NO_LONGER_AVAILABLE` notifications.
- Added safe same-origin deep-link resolution for assignment, assignment-submission, quiz, announcement, event, week, and group-set destinations.
- Added read-only announcement, event, week, and group-set notification destination pages with retry and unavailable states.
- Added a dedicated assignment-submission notification destination with version history and authenticated preview/download actions.

### Quiz vertical slice

- Added typed API coverage for quiz settings, question CRUD/reorder, publish/unpublish, attempts, autosave, submit/receipt, results, manual grading, and grade release/retract.
- Added quiz listings and authoring entry points to the course workspace.
- Added instructor quiz creation and settings, all four question types, answer-key inputs, question ordering/deletion, and publishing.
- Added student attempt start, per-question save, final confirmation/submit, receipt, pending-manual-grade, and released-result views.
- Added short-answer grading, objective/manual completion summaries, and release/retract controls.
- Added editing for existing questions, including answer keys and optimistic version checks, while respecting the backend's content lock after attempts exist.
- Added student attempt history, individual attempt-result expansion, remaining-attempt counts, and retake entry.
- Added searchable per-student Quiz grade release/retract selection backed by the course roster and each student's finalized attempts.

### Course events and groups

- Added course event list/detail/create/edit/delete routes with capability-scoped staff controls and confirmed deletion.
- Added group-set list/create/edit/delete, individual and batch group creation, group edit/delete, and course-workspace entry cards.
- Added student join/leave/switch flows and manager ungrouped-student assignment, move/remove, capacity override, and random distribution controls.
- Added explicit confirmation for group operations that can change academic state.

### Course and S3 material experience

- Fixed a Zustand/render-effect loop that crashed real course pages with `Maximum update depth exceeded`.
- Added stable query fallbacks so pending course-week data does not trigger repeated store writes.
- Added authenticated binary download and preview methods for course materials.
- Added Preview and Download actions to file materials, without exposing the Bearer token in a URL.
- Kept object storage opaque to the frontend; no MinIO or S3 host is hardcoded.
- Added Instructor week management: create, inline rename, full-permutation reorder, confirmed delete, publish, and unpublish.
- Added material management: multi-file upload, external links, inline rename, within-week reorder, cross-week move, and confirmed delete.
- Added an upload-first S3 verification fixture and mock behavior: newly uploaded files support preview/download/delete, while old pre-migration objects deliberately return 404.
- Reuse idempotency keys across automatic retries for week creation and file/link material creation.
- Added PRD-aligned TA content controls: a content-enabled TA can upload and delete only their own materials, while course/week structure stays Instructor-only.
- Replaced the fake empty course-edit shell with a real course-create form backed by `POST /v2/courses`, including required term dates, validation, API error details, and handoff to the new course.
- Added a versioned PDF Syllabus card: students can preview/download; Course Managers can upload, replace, restore the previous version, and logically remove it.
- Rebuilt Roster on the current member APIs with server-side search/role/status filtering, paging, batch email enrolment, student withdrawal, and TA promote/demote actions.
- Added a discoverable Roster entry to the Course Manager view and a card-style 390px layout with no horizontal overflow.
- Removed the fake course-level Publish button and the unsupported Course Card favourite/notification controls.
- Removed duplicate TipTap extensions and cancelled its deferred initialization on unmount, eliminating the editor/plugin conflict reported by the old course-create shell.

### Course-scoped access control

- Added a shared `/v2/me/courses` membership query and a fail-closed course-capability model.
- Replaced privileged global `user.level` checks in the current course, assignment, and grading flows with per-course `INSTRUCTOR`, `TA`, and `STUDENT` access.
- Limited assignment authoring and grade release to the course Instructor.
- Allowed TAs to grade only when `canGrade` is granted and kept TA material-upload access separate from their global account level.
- Prevented stale edit modes from rendering privileged course controls after access changes.
- Aligned the frontend capability model with the PRD's fifth TA toggle, `canManageContent`; it fails closed until the backend returns that field.

### Static design assets

- Restored all 320 PNG assets that had remained as Git LFS pointer text in the checkout.
- Verified the restored objects against their repository SHA-256 identifiers, including the login artwork, application logo, navigation icons, instructor avatars, and dashboard imagery.
- Store this 4.5 MiB asset set directly in Git so backup clones and deployment checkouts do not depend on a separately installed Git LFS client.

### Dashboard navigation and language rollout

- Made calendar dates real keyboard-accessible buttons with clear selected state.
- Made every Learning Schedule activity a whole-card link to the exact `courseId` supplied by the activity API, with hover, focus, and direction affordances.
- Made assignment titles and Submit/Resubmit actions open the exact assignment or quiz instead of dropping users at the course root.
- Made recent-announcement cards open the exact announcement destination.
- Replaced click-only dashboard `div`/`a` controls with semantic links so keyboard, screen-reader, open-in-new-tab, and browser-history behavior work normally.
- Replaced the fixed narrow mobile rail with a bottom navigation shell, converted Dashboard widgets to document-flow stacking on small screens, and removed mobile horizontal overflow.
- Made the profile menu and Dashboard chat menu, attachment controls, and Send action keyboard-accessible buttons with visible focus states.
- Fixed sidebar list semantics and contrast; automated WCAG A/AA scans report zero definite violations on Dashboard and Quiz grading in the verified mobile viewport.
- Temporarily removed language selectors from authentication, dashboard, and course headers and forced English startup while the Chinese translation remains incomplete. Chinese resource files remain available for the future full rollout.
- Removed the leftover All / Collect / HW1 design tabs rather than presenting unsupported controls.
- Replaced the static Skill Graph image with a student-only, real five-month Average Score chart calculated from released `/v2/courses/{courseId}/my-grades` assignment results; instructors do not receive the widget, and students with no released grades get an honest empty state.

### Verification and development support

- Added a local mock LMS server for safe UI testing without dev-database writes.
- Expanded the mock server into an interactive week/material preview so every management action can be reviewed even when 8081 is unavailable.
- Added service, authentication, upload, routing, deep-link, and store-loop regression tests.
- Current result: 360 tests passed across 85 test files.
- Current production Vite build succeeds.
- Both the standard and strict production TypeScript gates pass with the documented legacy quarantine excluded.
- Live 8081 notification unread-count and inbox GET flows were verified successfully.
- Live course 31 renders successfully after the store-loop fix.
- Browser verification covered student/instructor flows, notification navigation after Mark all read, keyboard activation, course creation, Syllabus role controls, Roster mutations, and 390px Dashboard/Course/Roster layouts with no Vite overlay.
- Registration browser verification covered code request/countdown, current request payload, automatic authenticated entry, error placement, keyboard order, and 390px layout against the local mock. Public 8084 verification covered the signup route and mobile layout; no real email or account was created on the shared Dev backend.
- Public 8084 login verification now reaches the same-origin API and renders `Incorrect email or password` for a deliberate invalid isolated account instead of the former generic CORS error.
- Public 8084 successful-login verification covered both designated Student accounts, the Instructor account, and the System Admin account. Each API login returned `SUCCESS`; browser sessions reached the Student/Instructor Dashboard or the System Admin Courses route with the expected role and no visible error state.
- The Dev review build points only to `https://dev.xlearnedu.com:8084/api` and is deployed at `https://dev.xlearnedu.com:8084`; Nginx proxies static content to a loopback-only PM2 process on 18084 and `/api` to the Dev API on 8081, while the timestamped release/current-symlink layout supports rollback.

## Known backend or environment blockers

- The dev host is reachable again as of the latest 2026-08-17 check (Swagger returned HTTP 200 and an unauthenticated v2 request returned the expected 401). Local write previews still use the in-memory API so they do not mutate shared dev data.
- Live `GET /v2/courses/31/weeks/11/materials/19/preview` returns HTTP 503. The authenticated frontend request reaches the correct endpoint; backend S3/preview configuration needs inspection.
- Live notifications `19` and `20` for user `385` contain question marks in the API response. Their source announcement titles are valid Chinese, while both source bodies also contain question marks. Exact IDs, source lookups, and database inspection SQL are documented in `BACKEND_HANDOFF_NOTIFICATION_TA.md`.
- The legacy Rocket.Chat provisioning step rejects the designated `@example.com` QA addresses with `error-invalid-domain`. The exception is caught and no longer blocks the LMS login/session, but Rocket.Chat availability for those QA users still requires a backend/chat-server domain-policy decision.
- Production token refresh still depends on the final frontend/API domain and refresh-cookie settings being compatible. The development proxy avoids the current cross-origin cookie and duplicate-CORS-header issues.
- The documented assignment-create API does not yet accept an `Idempotency-Key`. The frontend now prevents duplicate retries after it receives the created assignment ID, but an ambiguous network timeout after a server-side create still needs backend idempotency for complete protection.
- PRD defines five TA toggles, but the current backend and live Swagger expose only four. `canManageContent` is missing, current material authorization allows any Active TA, and teaching-dashboard endpoints still require global `INSTRUCTOR` level.

## Remaining frontend work

### P0 — integration completion

- Run controlled write E2E against 8081 for assignment creation/publishing, student submission, grade entry/release, notification read, and S3 download after backend approval.
- Run one approved live registration/email-delivery test on 8084; successful login is now verified with the designated Student, Instructor, and System Admin QA accounts.
- Re-test S3 preview/download/delete with a newly uploaded real file after the HTTP 503 is resolved; do not use old MinIO-era rows as the primary signal.
- Verify the remaining legacy screens before removing their fallback global-role state; current privileged course, assignment, and grading controls are course-scoped.
- Add client support for an assignment-create `Idempotency-Key` if/when the backend contract exposes it.
- Run controlled live write E2E for Syllabus upload/restore/remove, course creation, batch enrolment, TA promote/demote, and student Average Score using approved test accounts.

### P1 — missing product flows

- Continue broader Quiz edge-case UX and controlled live-backend verification for attempt/release behavior.
- Migrate the legacy Forgot Password page to the current `/v1/auth/email-verifications/reset` and `/v1/auth/password-resets` contract.
- Add rubric grading, annotated-file workflow, selected-grade release/retract, and existing-feedback retrieval.
- Replace the old static Notification Settings screen when a notification-preferences API contract is available.
- Add a course total/weighted-grade model only after the backend defines it; the current Average Score intentionally covers released assignments rather than inventing weighted course grades.

### P2 — stabilization and delivery

- Resolve legacy TypeScript debt in `ChatContent`, the old rich-text editor, sidebar typing, old detail-workspace models, and aggregate-store tests.
- Remove or migrate obsolete v1 assignment/detail workspace code after feature parity is confirmed.
- Complete Chinese translations for the full product, then re-enable the language selector as one coherent rollout.
- Continue mobile, screen-reader, and cross-browser QA across the remaining legacy routes.
- Add CI checks for tests, build, TypeScript, and contract drift.
- Define deployment, environment-variable, rollback, monitoring, and frontend error-reporting procedures.

## Recommended next sequence

1. Have the team review signup and the now-verified role-specific login destinations on 8084, then run one approved live verification-email/account-creation test.
2. Migrate Forgot Password to the current auth contract, then run controlled live writes for Syllabus, course creation, roster, assignment, quiz, event, and group flows.
3. Add rubric grading, annotated-file workflow, assignment selected-grade release/retract, and existing-feedback retrieval.
4. Continue keyboard, screen-reader, Safari/Chrome, and narrow-screen verification across remaining legacy routes, prioritizing AI Chat and Settings; then remove obsolete v1 course/roster/assignment code and close repository-wide TypeScript debt.

## Safety notes

- No SSH key or database credential is required by the frontend.
- No credential is committed in this repository.
- Business-data writes in this batch were exercised only against the local in-memory mock. External mutations were limited to the explicitly requested AWS Dev 8084 static deployment and its same-origin review API proxy; AWS Prod was not accessed.
