# Frontend-consumed contracts

This folder holds the advising contracts the frontend implements. It is not
the backend repository. When a frontend change exposes a contract gap, record
the expected/observed behavior here and hand it off. Do not invent endpoints.

| File | Authority |
|---|---|
| [`api/advising.openapi.yaml`](./api/advising.openapi.yaml) | Unique advising contract: Counsellor Intake, Advisor Core, Student/Tenant reads, and Gate C course orchestration |
| [`api/counsellor.openapi.yaml`](./api/counsellor.openapi.yaml) | Standalone Counsellor Intake copy of the A-gate paths |
| [`counsellor-dev-frontend-walkthrough.md`](./counsellor-dev-frontend-walkthrough.md) | Counselor Dev walkthrough |
| [`advisor-frontend-handoff.md`](./advisor-frontend-handoff.md) | Advisor Milestone B handoff |
| [`frontend-advising-progress.md`](./frontend-advising-progress.md) | Frontend A/B completeness, local test results, remaining gaps |

## Current frontend scope

- **Milestone A:** Counsellor Intake (create, unassigned queue, patch, first assign). No cancel, reassignment, or assigned-student detail for Counsellor.
- **Milestone B:** Advisor student queue, intake, profile, study plan, revisions; Student and TENANT_ADMIN read-only views; TENANT_ADMIN cancel / first-assign / reassign.
- **Milestone C:** Course orchestration is in the YAML. Do not wire mutations or pages until Promotion C is authorized. Writes currently return `409 ADVISING_FEATURE_DISABLED` when the C flag is off.

The product PRD (IELTS/GRE/TOEFL training operations) is the long-term picture. Parent accounts, alerts, exams, reports, and outbound email are not in the current backend contract and must not be stubbed.

Do not commit Dev/local passwords or fixture emails.
