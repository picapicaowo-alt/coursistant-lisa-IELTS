import { teachingLabel } from "@/components/TeachingWorkspace/presentation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { unwrapData, SCHEDULE_REQUEST_TYPES } from "@/apis";
import { courseOperationsApiService as api } from "@/apis/services/course-operations-api";
import {
  TeachingBadge,
  TeachingError,
  TeachingState,
} from "@/components/TeachingWorkspace";
import {
  EnglishDateInput,
  EnglishTimeInput,
} from "@/components/EnglishDateInput";
import { useIdempotencyCheckpoint } from "@/hooks/useIdempotencyCheckpoint";
import {
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
      if (version == null)
        throw new Error(
          "The request version is unavailable. Reload the request before reviewing it.",
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
          The server did not return a version. Review is unavailable until this
          request can be safely updated.
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
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    type: String(SCHEDULE_REQUEST_TYPES[1]),
    date: "",
    start: "",
    end: "",
    reason: "",
  });
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
  const checkpoint = useIdempotencyCheckpoint();
  const refresh = useRefreshTeaching(courseId);
  const change = draft.type === SCHEDULE_REQUEST_TYPES[1];
  const invalid =
    change &&
    (!draft.date || !draft.start || !draft.end || draft.end <= draft.start);
  const create = useMutation({
    mutationFn: () =>
      checkpoint.run("request-schedule-change", draft, (key, value) =>
        api.createCourseScheduleRequest(
          courseId,
          occurrenceId,
          {
            requestType: value.type,
            reason: value.reason.trim() || undefined,
            proposedOccurrenceDate: change ? value.date : undefined,
            proposedStartTime: change ? `${value.start}:00` : undefined,
            proposedEndTime: change ? `${value.end}:00` : undefined,
          },
          key,
        ),
      ),
    onSuccess: async () => {
      setCreating(false);
      await refresh();
    },
  });
  return (
    <div>
      <div className={s.toolbar}>
        <p className={s.muted}>Requests for this class</p>
        <button
          type="button"
          className={s.secondary}
          onClick={() => setCreating(!creating)}
        >
          {creating ? "Close form" : "Request a change"}
        </button>
      </div>
      {creating ? (
        <form
          className={s.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!invalid) create.mutate();
          }}
        >
          <label className={`${s.field} ${s.full}`}>
            Request type
            <select
              value={draft.type}
              onChange={(event) =>
                setDraft({ ...draft, type: event.target.value })
              }
            >
              {SCHEDULE_REQUEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {teachingLabel(type)}
                </option>
              ))}
            </select>
          </label>
          {change ? (
            <>
              <label className={`${s.field} ${s.full}`}>
                Proposed date
                <EnglishDateInput
                  required
                  value={draft.date}
                  onChangeValue={(date) => setDraft({ ...draft, date })}
                />
              </label>
              <label className={s.field}>
                Start
                <EnglishTimeInput
                  required
                  value={draft.start}
                  onChangeValue={(start) => setDraft({ ...draft, start })}
                />
              </label>
              <label className={s.field}>
                End
                <EnglishTimeInput
                  required
                  value={draft.end}
                  onChangeValue={(end) => setDraft({ ...draft, end })}
                />
              </label>
            </>
          ) : null}
          <label className={`${s.field} ${s.full}`}>
            Reason
            <textarea
              value={draft.reason}
              onChange={(event) =>
                setDraft({ ...draft, reason: event.target.value })
              }
            />
          </label>
          <div className={s.full}>
            <TeachingError error={create.error} />
          </div>
          <div className={s.actions}>
            <button
              className={s.primary}
              disabled={create.isPending || invalid}
            >
              Submit request
            </button>
          </div>
        </form>
      ) : null}
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
              <button
                type="button"
                className={s.textButton}
                onClick={() => setSelected(item)}
              >
                Review request
              </button>
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
