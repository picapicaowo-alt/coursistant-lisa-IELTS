# Mock Exam official equivalent answers

Tenant Admin Reading/Listening authoring now accepts a single official `answer`
string or an `answers` array of equivalent strings. The guided editor uses one
answer per line and writes exactly one key; changing back to a single line removes
`answers`. The Reading importer, section review and final payload builders share
validation. Missing keys, both keys, non-string or blank answers, empty arrays and
duplicate alternatives are rejected. Duplicate detection trims surrounding
whitespace only; it does not assume undocumented grading normalization. Official
text and word order are preserved in outgoing payloads: `cow dung` and `dung cow`
remain distinct.

Known active question slots are validated across nested forms, notes, summaries,
tables, flowcharts and other existing guided types. Listening plan/map remains
in Advanced data and validates its existing labelled answer slots. Arbitrary
custom kinds keep the existing compatibility-review boundary because their
payload schemas are unspecified; metadata and dormant text-cell IDs are not
interpreted as questions. Invalid imported answer fields remain visible for
correction, rather than being silently discarded or converted.

`multiSelect` continues to use its existing `answersByQuestion` payload. Student
answer rendering, requests and submission services are unchanged. The Tenant
Admin student-view preview still strips all answer-key fields, accepts one local
response string and never writes preview responses into authoring data.

## Contract source

The checked-in `docs/api/mockexam.openapi.yaml` and the latest fetched frontend
`origin/main` (`e516311`, inspected September 4, 2026) still declare generic
`JsonNode` question payloads, without `answer` / `answers` / `answersByQuestion`
properties or equivalent-answer normalization rules. The implementation uses the
explicit API-owner rules supplied in this task for those fields. No OpenAPI
content was fabricated or overwritten. The newly supplied `mockexam.openapi(3).yaml` matches this consumed snapshot
after line-ending normalization and also omits these payload fields. The
frontend contract needs the updated payload documentation when supplied. Existing create-only section routes and
read-only saved sections remain unchanged.

## Save-error regression and release validation

The four initial failures were the same server-error assertion at 1752, 1440,
1024 and 390 pixels. The original shared checkout still used the older
`getApiErrorMessage`, which displayed the API's diagnostic message. Current
`origin/main` already has the shared fix in `a0d70f5`: HTTP 5xx and transport
failures use the caller's action-specific fallback, while actionable validation
and domain messages remain available. This branch integrates the authoring change
onto that current main; it does not duplicate the error handler or weaken the
four message assertions. Both save-error paths keep the draft available to edit
or retry.

Validation is run in an isolated worktree with the committed lockfile and no
unrelated working-copy changes. Lint, both TypeScript checks, all 732 unit tests
and production/Dev builds passed. All 259 browser tests passed with zero
retries, including the four previously failing viewport cases. The existing
two-part creation fixture was updated to fill its required official answers. The dedicated equivalent-answer test also checks duplicate
rejection, the outgoing answers array and identical retry payloads.

These are local fixture checks, not authenticated backend grading acceptance.
The approved release target is IELTS frontend Dev 8085 only. Student requests,
API routes, environment settings and dependency manifests remain unchanged.
