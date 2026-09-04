import { teachingLabel } from "@/components/TeachingWorkspace/presentation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { unwrapData } from "@/apis";
import { courseOperationsApiService as api } from "@/apis/services/course-operations-api";
import {
  TeachingBadge,
  TeachingError,
  TeachingState,
} from "@/components/TeachingWorkspace";
import { useIdempotencyCheckpoint } from "@/hooks/useIdempotencyCheckpoint";
import {
  isInstructorScheduleRequestReviewable,
  operationKeys,
  recordPage,
  recordId,
  optionalNumber,
  textValue,
  dateLabel,
  type OperationRecord,
} from "./records";
import { useRefreshTeaching } from "./useCourseRecords";
import s from "@/components/TeachingWorkspace/index.module.scss";

export function ScheduleReview({
  courseId,
  request,
  onSaved,
}: {
  courseId: number;
  request: OperationRecord;
  onSaved: () => Promise<void>;
}) {
  const [decision, setDecision] = useState("APPROVE");
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const checkpoint = useIdempotencyCheckpoint();
  const version = optionalNumber(request, "version");
  const mutation = useMutation({
    mutationFn: () => {
      if (version == null || !isInstructorScheduleRequestReviewable(request))
        throw new Error(
          "Reopen this request before reviewing it.",
        );
      const payload = {
        decision,
        expectedVersion: version,
        rejectionReason: decision === "REJECT" ? reason.trim() : undefined,
      };
      return checkpoint.run(
        "review-schedule-request",
        { id: recordId(request, "requestId", "id"), payload },
        (key, value) =>
          api.reviewCourseScheduleRequest(
            courseId,
            value.id,
            value.payload,
            key,
          ),
      );
    },
    onSuccess: async () => {
      setSaved(true);
      await onSaved();
    },
  });
  if (!isInstructorScheduleRequestReviewable(request)) return <TeachingBadge value={textValue(request, 'status')}/>;
  return (
    <form
      className={s.form}
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <label className={s.field}>
        Your decision
        <select
          value={decision}
          onChange={(event) => {
            setDecision(event.target.value);
            setSaved(false);
          }}
        >
          <option value="APPROVE">Approve</option>
          <option value="REJECT">Reject</option>
        </select>
      </label>
      {decision === "REJECT" ? (
        <label className={`${s.field} ${s.full}`}>
          Reason for rejection
          <textarea
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      ) : null}
      {version == null ? (
        <p className={`${s.notice} ${s.full}`}>
          Reopen this request to load the latest details before reviewing it.
        </p>
      ) : null}
      <div className={s.full}>
        <TeachingError error={mutation.error} />
        {saved ? (
          <p className={s.success} role="status">
            Review saved.
          </p>
        ) : null}
      </div>
      <div className={s.actions}>
        <button
          className={s.primary}
          disabled={
            saved ||
            version == null ||
            mutation.isPending ||
            (decision === "REJECT" && !reason.trim())
          }
        >
          {mutation.isPending ? "Saving…" : "Submit review"}
        </button>
      </div>
    </form>
  );
}

export function OccurrenceRequests({
  courseId,
  occurrenceId,
}: {
  courseId: number;
  occurrenceId: number;
}) {
  const [selected, setSelected] = useState<OperationRecord>();
  const query = useQuery({
    queryKey: [...operationKeys.requests(courseId), occurrenceId],
    queryFn: async () =>
      recordPage(
        unwrapData(
          await api.listCourseScheduleRequests(courseId, occurrenceId),
          "schedule requests",
        ),
      ),
    retry: false,
  });
  const refresh = useRefreshTeaching(courseId);
  return (
    <div>
      {query.isPending || query.isError || !query.data?.items.length ? (
        <TeachingState
          loading={query.isPending}
          error={query.error}
          empty="No schedule requests for this class."
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className={s.recordList}>
          {query.data.items.map((item) => (
            <article
              className={s.record}
              key={recordId(item, "requestId", "id")}
            >
              <div className={s.recordHeader}>
                <div>
                  <strong>
                    {teachingLabel(textValue(item, "requestType"))}
                  </strong>
                  <small className={s.subline}>
                    {dateLabel(textValue(item, "proposedOccurrenceDate"))}
                  </small>
                </div>
                <TeachingBadge value={textValue(item, "status")} />
              </div>
              {textValue(item, "reason") ? (
                <p>{textValue(item, "reason")}</p>
              ) : null}
              {isInstructorScheduleRequestReviewable(item) ? <button
                type="button"
                className={s.textButton}
                onClick={() => setSelected(item)}
              >
                Review request
              </button> : null}
            </article>
          ))}
        </div>
      )}
      {selected ? (
        <section className={s.notice}>
          <h3>Instructor review</h3>
          <ScheduleReview
            key={`${recordId(selected, "requestId", "id")}-${optionalNumber(selected, "version")}`}
            courseId={courseId}
            request={selected}
            onSaved={async () => {
              await refresh();
              setSelected(undefined);
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
