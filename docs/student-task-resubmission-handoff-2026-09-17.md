# Student task resubmission contract handoff

## Requested behavior

After a study-plan task has been submitted, the student should be able to revise the submission note or file and use a clearly labelled **Resubmit** action.

## Current consumed contract

`docs/api/advising.openapi.yaml` currently exposes:

- `POST /v2/student/study-plan/tasks/{taskId}/start`
- `POST /v2/student/study-plan/tasks/{taskId}/complete`
- `PUT /v2/student/study-plan/tasks/{taskId}/submission-file`

The complete operation is documented as moving a task to `COMPLETED` and may return `409 ADVISOR_TASK_STATE_CONFLICT`. The contract does not define a reopen or resubmit operation, a resubmission capability flag, an allowed-attempt count, or the behavior of calling `complete` for an already completed task.

## Frontend behavior pending a contract decision

- `NOT_STARTED` and `IN_PROGRESS` tasks show the localized **Submit** action.
- `COMPLETED` tasks show the saved submission read-only.
- The frontend does not issue an undocumented repeat `complete` request or display a non-functional Resubmit action.

## Backend decision needed

Either document and support idempotent resubmission through the existing `complete` operation, or add an explicit versioned resubmission operation. The response should return the updated task version and submission data, and the contract should define whether an attached file is retained, replaced, or removed.
