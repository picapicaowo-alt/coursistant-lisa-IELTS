# Instructor calendar permission audit

## Findings

- The supplied refreshed Dev 8085 screenshot shows HTTP 403 for `GET /api/v2/me/personal-events`. The screenshot uses the current `index-DnXVq49j.js` entry. Earlier missing-module/MIME errors are absent from the refreshed screenshot.
- Calendar and Teaching operations both use `CourseOperationsApiService.listMyPersonalEvents`, sending the required `fromUtc` and `toUtc` date-time parameters from `docs/api/course.openapi.yaml` (`listMyPersonalEvents`). The shared authenticated client supplies the Bearer token. Login, signup, and successful refresh synchronize the client token; a full reload initializes it from persisted session storage.
- The course calendar uses a separate `/v2/me/calendar` read. Seeing course data does not prove permission to read personal events or course members.
- The consumed personal-event contract does not specify role eligibility. HTTP 403 establishes server refusal, not whether its policy is correct. The live account's request headers, response business code, and effective authorization were not captured: its browser tab is held by another session. Do not infer a backend implementation defect or grant permissions from the screenshot alone.
- The earlier course-member 403 is a separate server rejection. Structured-name rendering, filtering, pagination, and parent navigation pass fixture regressions; that does not establish live membership access for the pictured instructor.

## Frontend correction

Failed personal-event reads could also render `No personal events.` in the expanded Teaching operations panel. Mobile Calendar could render `No events` for every day while a source was unavailable. These messages imply a successful empty result.

Teaching operations now distinguishes loading, failed, and empty reads. Calendar renders empty messages only when both sources succeeded without reported missing data. Existing error notices, valid records, and manual retries remain available. The change does not alter API paths, request parameters, authentication, or role policy, and does not resolve a server 403.

## Verification

- Audited the deployed `3a022e9661b1d00b8be4f6b6f70ca6cd77bc7965` artifact: homepage and all 346 assets matched the local release hashes and expected JavaScript/CSS MIME types.
- Targeted auth, API service, context, and calendar unit tests: 19 passed. Initial existing-build browser checks: 10 passed, including roster navigation and personal-event write contracts.
- Added isolated Instructor browser regressions for both calendar entry points: authenticated request shape, 403 visibility, no misleading empty state, explicit retry with unchanged parameters, successful recovery, no refresh call on 403, and no mutation during reads/retry. Mock credentials and intercepted APIs are used; this is not live-account acceptance.
- The mobile empty-state regression fails against the previously deployed artifact and passes with the correction.
- Merge baseline: clean `npm ci --no-audit --no-fund`, lint, both TypeScript checks, 137 unit files / 576 tests, production and development builds, and 138 Playwright tests passed. The package manifest and lockfile are unchanged. The initial install stalled after package installation; disabling npm's advisory-network audit allowed the clean install to finish.

Backend investigation and changes are deferred at the user's request. No backend source, permissions, environment values, or account data are changed.
