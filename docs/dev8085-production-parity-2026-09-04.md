# Restore Production to the accepted Dev 8085 frontend

The user requested exact reproduction of Dev 8085 across every role and page, and explicitly withdrew the proposed Admin create-course label/dialog change. The implementation restores the complete runtime source and browser tests to the verified Dev release `60646f296c184a7f5700354f1741f5ccb1266370` rather than introducing new layouts or changing role permissions.

## Baseline and scope

- Live Dev entry assets match `20260904T090923Z-60646f29-mock-answer-keys`. All 735 content files in its saved release manifest match live SHA256 reads. `/REVISION` currently returns SPA HTML and is not treated as version evidence.
- All `lms/src` runtime files and `lms/e2e` tests are restored from that exact revision. The only additional source file is the existing `config/productionEnv.test.ts`, which tests deployment configuration and does not render UI.
- Production retains its already verified Tokyo `.env.production`, public API `https://api-cn.xlearnedu.com/api`, Cookie behavior and deployment documentation. No environment configuration is changed by this restoration.
- The rebuilt Production artifact matches all 449 baseline CSS and non-entry static assets byte for byte. Environment-specific JS and the entry manifest are expected to differ.
- The restoration covers shared shells/tokens, role navigation, dashboards, course workspaces, calendars, exams, grading, counselling/advising, tenant governance, Parent, Student and Vocabulary pages, including their existing forms and dialogs.
- System Admin and Tenant Admin retain their distinct Dev role capabilities and entry pages. Data and account membership come from the selected environment; this is not a data migration.
- This supersedes the UI changes described in `uiux-consistency-audit-2026-09-04.md` for the restored deployment. It does not claim full product localization: it preserves the accepted Dev implementation and introduces no new UI strings or features.

## Validation before publication

- `npm run lint:ci`: passed.
- `npm run typecheck` and `npm run typecheck:production`: passed.
- `npm run test:run`: 150 files / 735 tests passed.
- `npm run build`: passed, with Tokyo configuration retained.
- `PLAYWRIGHT_PORT=4209 npm run test:e2e -- --workers=4`: 259 tests passed in one complete run.

Real browser acceptance is recorded separately from these fixture-based checks. The user supplied eight Dev accounts spanning Tenant Admin, Counsellor, Advisor, Instructor, Student and Parent, plus Production System Admin and 22 Counsellor/Advisor/Instructor accounts. These are different account sets. No account, course, enrollment, parent link, backend or database is created or changed by the restoration.

Evidence is retained in the original workspace under `output/dev8085-parity-20260904/`: source/static asset parity, full check logs, actual route screenshots, login/refresh/logout outcomes and release/rollback manifests. Credentials and access tokens are not committed. Publication and live results are reported only after their checks complete.
