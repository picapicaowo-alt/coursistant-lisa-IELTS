# Instructor roster and course navigation correction

## Confirmed frontend defects

- `CourseMember` and the roster row only consumed legacy `userName`. The checked-in `docs/api/course.openapi.yaml` `MemberResponse` defines `userFirstName`, `userMiddleName`, and `userLastName`. The roster now formats those fields through the existing person-name formatter, with the legacy display name and email as fallbacks. Names are never split or written back.
- Course operations returned to `/course/:courseId`, opening the learning overview (for example, Academic Writing Studio), instead of the course list from which operations was opened. Its Back link now returns to `/course`; Course overview remains a separate shortcut.
- The overview header returned to the dashboard. It now returns to the course list.
- Roster Back always opened the learning overview. It now returns to course operations by default. The overview's Manage roster link supplies its own course path as navigation state; the roster accepts only that exact same-course overview as an alternate parent. No browser-history back action or arbitrary return URL is used.
- The operations roster shortcut is now shown only to the course Instructor or System Admin, matching the roster's existing authorization guard.

## API and access boundary

`GET /v2/courses/{courseId}/members` (`courseMemberList`) remains unchanged. Search (`q`), role (`courseRole`), active status (`active`), and pagination (`page`, `size`) remain server-owned. Membership access still comes from `/v2/me/courses`; the backend remains the final authorization authority. No backend, environment, account, or deployment values were changed.

## Validation

- Targeted Vitest checks: 4 files, 24 tests passed (roster hook, course access, person-name formatter, course service).
- TypeScript: normal and production checks passed.
- ESLint: all changed TypeScript/TSX files and the new browser regression test passed with zero warnings.
- Production build: passed using isolated output `/tmp/coursistant-instructor-qa-20260903/dist`.
- Playwright: 4 tests passed against that isolated build, covering the catalogue → operations → roster → operations → catalogue path; structured and legacy names; server search, filters, and pagination; overview → roster → overview → catalogue; 390 px mobile layout; and the TA shortcut boundary.
- Mobile screenshot visually inspected; no horizontal page overflow.

## Pre-merge verification

The release branch was isolated from the user's existing uncommitted work and based on `6ec8404` (merged main). Clean dependency installation, full lint, both TypeScript checks, all 134 Vitest files / 565 tests, the production build, and all 126 Playwright tests passed. Dependency manifests and lockfiles are unchanged.

These are frontend checks using intercepted test fixtures, not authenticated Dev acceptance. A separate Dev review tab opened at login, so the reported account's live roster payload and permissions were not inspected. The name-field mismatch is confirmed from code and the consumed contract; any additional live-data failure remains unverified. Dev 8085 promotion and artifact verification are recorded separately after building clean merged main.
