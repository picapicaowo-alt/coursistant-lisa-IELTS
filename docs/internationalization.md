# Product internationalization

Supported locales: `en`, `zh-CN`, `zh-TW`. The shared architecture is
`lms/src/i18n/`, using i18next/react-i18next. Locale resources, persistence,
missing-key fallback/warnings and formatting belong there, not to individual
pages or roles. All new or changed UI must have complete three-locale parity.

## IELTS content boundary

Translate platform controls and feedback. Do **not** translate examination
passages, question stems, paper instructions, choices, answer codes, student
responses or original question images/audio. Likewise, preserve authored
learning material, vocabulary, names and user content. An English IELTS paper
inside a Chinese platform interface is intentional, not mixed-locale UI debt.

Authoring labels and validation use locale resources; submitted content does
not. Canonical paper fallback titles use a fixed English translator only at the
payload boundary. API enums, IDs, section sequences, grading answer structure,
React keys and idempotency/version checkpoints are locale-independent.

Platform illustrations containing English may be replaced by localized HTML or
locale-specific artwork. This must never replace or modify original exam media.

## Implementation invariants

- Use `useTranslation` for rendered UI and shared translation helpers for
  presentation outside React. Reuse semantic keys across pages when equivalent.
- Keep errors/receipts as semantic identities and interpolation data; render
  them in the current language. Do not expose unlocalized server diagnostics.
- Use shared number/date/time formatting. Preserve date-only values and course
  wall-clock/timezone semantics; keep API serialization unchanged.
- Language switches must preserve filters, drafts, open dialogs, media URLs,
  student answers, pending request guards, retry IDs and permissions.
- Native form validation uses the shared locale bridge in `nativeValidation.ts`.
  It changes feedback only, never field values or HTML constraints. Custom date
  and people controls retain their own semantic validation messages.
- Do not translate machine conditions, select values or React component keys.
- English is an emergency missing-key fallback. Development warnings and
  translation-key checks do not excuse missing supported resources.

## Checks and evidence

`npm run i18n:keys` checks locale parity, literal semantic references, required
interpolation parameters in literal option objects, translated options without
explicit values, translated business comparisons and translated React keys.
`npm run i18n:check` is a strict direct-UI-literal gate on the active
entry-point dependency graph. Its narrowly reviewed exceptions identify exact
exam instructions or product symbols, never entire pages. `npm run i18n:audit`
also reports templates/fallbacks for human classification; URLs and API values
must not be translated merely to reduce its count.

`src/i18n/exam-authoring.test.tsx` verifies identical Reading/Listening/Writing
payloads across all three locales, unchanged answers/media references and
retained authoring/import drafts. `src/i18n/exam-runner.test.tsx` and
`e2e/i18n-exam-runner.spec.ts` cover paper text, answer selections, notes,
writing drafts and retry data while changing language. The browser matrix uses
three locales and desktop/mobile widths. These are fixture tests, not real
Production exam submissions.

## Integrated frontend evidence — 2026-09-05

The release branch was created from main `c8df46a2436a4aabdef0eb051f44b79eabb80e8a`.
The older shared checkout is not a release source. Localization is being ported
without its unrelated pending API adaptations. Main's submitted-section locks,
0–9/half-step writing grading, all-page student picker, hidden TA UI, course
readiness/schedule gates and profile identity behavior must remain intact.

Integration covers the active route tree: authentication, navigation, student,
parent, counsellor, advisor, instructor/combined roles, tenant/system governance,
course and assessment workspaces, vocabulary, shared editors, dialogs, error and
success feedback. Known status/role codes use shared presentation helpers while
API values and authored content remain unchanged.

Validated on the integrated branch:

- Lint, normal/production/i18n-tool type checks, resource/key/interpolation checks
  and all six audit-tool tests pass. There are zero unreviewed direct UI copy
  candidates across the 465-file active dependency graph.
- 171 unit-test files / 849 tests pass, including open-dialog locale changes,
  nested translated labels, auth validation/feedback, draft and retry identity.
- The production build succeeds. All 364 Chromium browser tests pass. The role
  layout matrix covers nine role/page configurations in all three locales at
  widths 320, 390, 768, 1024, 1440, 1920 and 2560; it checks locale persistence,
  overflow, unresolved interpolation and untranslated platform controls.
- Reading, Listening and Writing tests cover all three locales on desktop and
  mobile, preserving original paper text, TFNG answer values, media references,
  answer/notes/writing drafts and failed-submission retry behavior.
- Authentication's English dashboard/goal rasters are replaced with localized
  HTML previews. Active platform image references are icons or brand marks;
  original exam media is untouched. Old English illustrations and date helpers
  found in unreachable legacy prototypes are not rendered by the application.

The broader read-only audit also lists machine paths, API identifiers, diagnostic
exceptions and IELTS instructions. Its count is deliberately not forced to zero
by translating those values. Static gates do not guarantee semantic quality of
every future dynamic string; dynamic status additions and authored-content
boundaries remain part of code review.

## Release status

Authorized destination: Tokyo Production (`app.xlearnedu.com`) only. Deployment
requires a clean merged build, artifact integrity checks and real login, refresh,
role reads and logout. AWS credentials were expired at the preflight and need
reauthentication. No production deployment or authenticated acceptance of this
revision is claimed by the fixture results above.
