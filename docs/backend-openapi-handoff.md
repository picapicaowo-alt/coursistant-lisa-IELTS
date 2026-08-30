# Backend OpenAPI handoff

This file records integration limits discovered by the frontend. It does not
authorize changes to backend code or deployment.

## `/api/v3/api-docs` returns 500

The shared Dev business routes are registered: representative unauthenticated
requests reach the service and return the expected `401 INVALID_TOKEN`. The
aggregated Springdoc endpoint at `/api/v3/api-docs`, however, returns HTTP 500.

This means the documentation generator or its aggregation configuration is
failing independently of ordinary request routing. It does **not** block the
static frontend release, but it does block an authoritative live comparison of
operation counts against Dev.

Backend follow-up requested:

1. Inspect the Springdoc exception for `/api/v3/api-docs` and restore a valid
   OpenAPI JSON response.
2. Confirm that Parent, Notification, Counsellor, and Advising controllers are
   included in the intended API-doc group, alongside Assignment, Auth, Course,
   Mock Exam, Quiz, and User.
3. Once fixed, compare the live operation list with the nine frontend-consumed
   YAML files in `docs/api/`.

## Missing concrete success payload schemas

The supplied Course and Mock Exam contracts describe their success payloads
with a generic `ApiResponse` throughout. Parent does the same for all 30
operations; Assignment, Auth, and User also leave most response `data` payloads
untyped. Fourteen Advising operations—including dashboard, hub, reports, and
conversation operations—do not provide a concrete success payload schema.

The frontend has not guessed those shapes. New reads at these boundaries use
`unknown` and render through `ContractDataView`. Please add concrete response
schemas (including paginated item fields and optimistic `version` fields) so
those screens can graduate from a contract-data view to fully typed product UI.

## Current comparison boundary

The checked-in snapshot contains 301 paths and 375 HTTP operations across the
nine YAML files. Nine operations are explicitly named `*Disabled` (four in Auth
and five in User) and remain intentionally unavailable in the frontend. The
Mock Exam examination loop is now implemented in the frontend, but most Mock
Exam success responses still resolve to the generic `ApiResponse` payload.
Please publish concrete list, detail, attempt, submission, writing-grade, and
section/media metadata schemas so the current runtime validation can be
replaced with generated response types.
