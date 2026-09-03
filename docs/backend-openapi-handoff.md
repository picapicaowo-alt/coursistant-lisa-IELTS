# Backend OpenAPI handoff

Updated 2026-09-03 for the client-delivery review. This records frontend integration limits; it does not authorize backend changes.

## Live documentation

`GET https://dev.xlearnedu.com:8085/api/v3/api-docs` returned HTTP 500 again during this review. The aggregate response cannot currently establish whether the backend's latest compatibility update matches the consumed snapshot. Please restore the OpenAPI response or supply the exact versioned export for that update. No newer contract revision was present on `origin/main` at the review baseline `49c8a1dd`.

## Consumed snapshot and comparison

`docs/api/` contains **11 YAML snapshots, 337 unique paths and 431 HTTP operations**: Advising, Assignment, Auth, Counsellor, Course, Mock Exam, Notification, Parent, Quiz, User and Vocabulary. These replace the older nine-file / 301-path / 375-operation count previously recorded here.

Nine operations explicitly named `*Disabled` remain unavailable: four Auth administrator writes and five User writes. Their presence in OpenAPI is not authorization to expose those disabled operations.

A TypeScript AST audit matched all **382 direct literal/template v1/v2 service call sites** against method/path definitions after removing four unsupported tenant-admin legacy methods. Six dynamic GET sites were reviewed separately: Advisor and Student conversation cursors, four scoped conversation attachment destinations, and ten exam-media destinations. These use only their corresponding contracted role scopes. The separate Vocabulary/AI integrations were covered by existing transport and browser tests; the v1/v2 count does not include every external service call or prove schema/runtime compatibility.

The full operation mapping remains in [the operation matrix](frontend-operation-matrix-2026-09-02.md). The screen-specific gaps and current frontend behavior are in [Figma parity handoff B01–B16](advisor-figma-backend-handoff.md).

## Typed reads and remaining input schemas

Some success responses are still generic, including several Course, Mock Exam, Parent, Auth and User reads. Other operations now have explicit projections and must not be requested again as if absent. The frontend uses runtime guards for generic data and displays returned values through product components; an empty response is not a successful mutation message.

Please supply populated/empty/error fixtures, collection paging guarantees, names/identity projections and concurrency/version fields for the remaining generic reads. In particular, Listening/Reading authoring still needs per-question-kind payload and paragraph schemas before its JSON content entry can be replaced safely with a visual editor.

The Parent link schema and runtime compatibility behavior also need reconciliation: the snapshot declares an array while existing compatibility envelopes use `items/page/size/total`. The frontend supports both, without assuming a parent's name identifies the linked student.

## Acceptance boundary

Static request matching and isolated browser fixtures do not prove authenticated backend behavior, authorization enforcement, or that an unpublished compatibility update was consumed. Supply the latest contract bundle and designated role fixtures for the final frontend/backend acceptance round. Existing frontend request paths, environment values and proxy inputs remain unchanged except removal of the four undocumented legacy tenant administration calls.
