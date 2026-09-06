import {useTranslation} from 'react-i18next';
import {LocalizedError} from '@/i18n/errors';
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
  const {t: translate} = useTranslation();
  const [decision, setDecision] = useState("APPROVE");
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const checkpoint = useIdempotencyCheckpoint();
  const version = optionalNumber(request, "version");
  const mutation = useMutation({
    mutationFn: () => {
      if (version == null || !isInstructorScheduleRequestReviewable(request))
        throw new LocalizedError("operations:errors.reloadRequest");
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
    <form noValidate
      className={s.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!mutation.isPending && (decision !== 'REJECT' || reason.trim())) mutation.mutate();
      }}
    >
      <label className={s.field}>
        {translate("operations:yourDecision")}<select
          value={decision}
          onChange={(event) => {
            setDecision(event.target.value);
            setSaved(false);
          }}
        >
          <option value="APPROVE">{translate("operations:approve")}</option>
          <option value="REJECT">{translate("operations:reject")}</option>
        </select>
      </label>
      {decision === "REJECT" ? (
        <label className={`${s.field} ${s.full}`}>
          {translate("operations:rejectionReason")}<textarea
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      ) : null}
      {version == null ? (
        <p className={`${s.notice} ${s.full}`}>
          {translate("operations:reloadRequest")}</p>
      ) : null}
      <div className={s.full}>
        <TeachingError error={mutation.error} />
        {saved ? (
          <p className={s.success} role="status">
            {translate("operations:reviewSaved")}</p>
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
          {mutation.isPending ? translate("common:actions.saving") : translate("operations:submitReview")}
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
  const {t: translate} = useTranslation();
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
          empty={translate("operations:noClassRequests")}
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
                {translate("operations:reviewRequest")}</button> : null}
            </article>
          ))}
        </div>
      )}
      {selected ? (
        <section className={s.notice}>
          <h3>{translate("operations:instructorReview")}</h3>
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
