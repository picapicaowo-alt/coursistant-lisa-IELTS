import {useTranslation} from 'react-i18next';
import {LocalizedError} from '@/i18n/errors';
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  MoreHorizontal,
  Plus,
  RefreshCw,
} from "lucide-react";
import { generatePath, Link } from "react-router-dom";
import { unwrapData } from "@/apis";
import { courseOperationsApiService as api } from "@/apis/services/course-operations-api";
import { APP_ROUTE_PATHS } from "@/configs/routePaths";
import {
  EnglishDateInput,
  EnglishTimeInput,
} from "@/components/EnglishDateInput";
import {
  TeachingBadge,
  TeachingDialog,
  TeachingError,
  TeachingState,
} from "@/components/TeachingWorkspace";
import { useIdempotencyCheckpoint } from "@/hooks/useIdempotencyCheckpoint";
import {
  useCourseOccurrences,
  useCourseWeeks,
  useCourseSessions,
  useRefreshTeaching,
} from "./useCourseRecords";
import {
  dateLabel,
  timeRange,
  parseOccurrence,
  occurrenceTitle,
  type Occurrence,
} from "./records";
import { OccurrenceRequests } from "./OccurrenceRequests";
import s from "@/components/TeachingWorkspace/index.module.scss";

type Editor =
  { kind: "create" | "generate" } | { kind: "detail"; occurrence: Occurrence };
export function OccurrencePanel({
  courseId,
  onAttendance,
  canManageSchedule = false,
}: {
  canManageSchedule?: boolean;
  courseId: number;
  onAttendance: (id: number) => void;
}) {
  const {t: translate} = useTranslation();
  const [range, setRange] = useState({ from: "", to: "", history: true });
  const [editor, setEditor] = useState<Editor>();
  const [saved, setSaved] = useState("");
  const [showDates, setShowDates] = useState(false);
  const query = useCourseOccurrences(
    courseId,
    range.from || undefined,
    range.to || undefined,
    range.history,
  );
  const weeks = useCourseWeeks(courseId);
  const refresh = useRefreshTeaching(courseId);
  const finish = async (message: string) => {
    setSaved(message);
    setEditor(undefined);
    await refresh();
  };
  return (
    <section className={s.panel} aria-label={translate("operations:sessionOccurrences")}>
      <div className={s.toolbar}>
        <div className={s.toolbarGroup}>
          <button
            className={s.secondary}
            type="button"
            aria-expanded={showDates}
            onClick={() => setShowDates(!showDates)}
          >
            <CalendarDays size={18} />
            {range.from || range.to ? translate("operations:customDates") : translate("operations:allDates")}
          </button>
          <label className={s.field}>
            <span className={s.subline}>{translate("operations:includeHistory")}</span>
            <input
              type="checkbox"
              checked={range.history}
              onChange={(event) =>
                setRange({ ...range, history: event.target.checked })
              }
            />
          </label>
        </div>
        {canManageSchedule ? <div className={s.toolbarGroup}>
          <button
            className={s.secondary}
            type="button"
            onClick={() => setEditor({ kind: "generate" })}
          >
            <RefreshCw size={16} />
            {translate("operations:generateFromSchedule")}</button>
          <button
            className={s.primary}
            type="button"
            onClick={() => setEditor({ kind: "create" })}
          >
            <Plus size={18} />
            {translate("operations:createOccurrence")}</button>
        </div> : null}
      </div>
      {showDates ? (
        <div className={s.toolbar}>
          <label className={s.field}>
            {translate("operations:from")}<EnglishDateInput
              value={range.from}
              onChangeValue={(from) => setRange({ ...range, from })}
            />
          </label>
          <label className={s.field}>
            {translate("operations:to")}<EnglishDateInput
              value={range.to}
              onChangeValue={(to) => setRange({ ...range, to })}
            />
          </label>
          <button
            type="button"
            className={s.textButton}
            onClick={() => setRange({ ...range, from: "", to: "" })}
          >
            {translate("operations:clearDates")}</button>
        </div>
      ) : null}
      {saved ? (
        <p role="status" className={s.success}>
          {translate(saved)}
        </p>
      ) : null}
      {query.isPending || query.isError || !query.data?.length ? (
        <TeachingState
          loading={query.isPending}
          error={query.error}
          empty={translate('operations:noOccurrences')}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className={s.tableWrap}>
          <table className={`${s.table} ${s.responsive}`}>
            <thead>
              <tr>
                <th>{translate("common:fields.date")}</th>
                <th>{translate("common:dateTime.time")}</th>
                <th>{translate("operations:session")}</th>
                <th>{translate("operations:lecture")}</th>
                <th>{translate("common:fields.status")}</th>
                <th>{translate("common:fields.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((item) => (
                <tr key={item.id}>
                  <td data-label={translate("common:fields.date")}>
                    <strong>{dateLabel(item.date)}</strong>
                  </td>
                  <td data-label={translate("common:dateTime.time")}>
                    <span className={s.muted}>
                      {timeRange(item.startTime, item.endTime)}
                      {item.timezone ? (
                        <small className={s.subline}>{item.timezone}</small>
                      ) : null}
                    </span>
                  </td>
                  <td data-label={translate("operations:session")}>
                    <span>{occurrenceTitle(item, weeks.data)}</span>
                  </td>
                  <td data-label={translate("operations:lecture")}>
                    <span className={s.muted}>
                      {item.weekId
                        ? translate('operations:lectureNumber', {id: weeks.data?.find((week) => week.id === item.weekId)?.lectureNumber ?? item.weekId})
                        : translate("operations:notLinked")}
                    </span>
                  </td>
                  <td data-label={translate("common:fields.status")}>
                    <TeachingBadge value={item.status} />
                  </td>
                  <td data-label={translate("common:fields.actions")}>
                    <button
                      type="button"
                      className={s.iconButton}
                      aria-label={translate('operations:manageClass', {date: dateLabel(item.date)})}
                      onClick={() =>
                        setEditor({ kind: "detail", occurrence: item })
                      }
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editor?.kind === "detail" ? (
        <OccurrenceDetails
          courseId={courseId}
          occurrence={editor.occurrence}
          onClose={() => setEditor(undefined)}
          onSaved={finish}
          onAttendance={onAttendance}
          canManageSchedule={canManageSchedule}
        />
      ) : editor && canManageSchedule ? (
        <OccurrenceEditor
          courseId={courseId}
          mode={editor.kind}
          onClose={() => setEditor(undefined)}
          onSaved={finish}
        />
      ) : null}
    </section>
  );
}

function OccurrenceDetails({
  courseId,
  occurrence,
  onClose,
  onSaved,
  onAttendance,
  canManageSchedule,
}: {
  canManageSchedule: boolean;
  courseId: number;
  occurrence: Occurrence;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  onAttendance: (id: number) => void;
}) {
  const {t: translate} = useTranslation();
  const [mode, setMode] = useState<
    "detail" | "reschedule" | "cancel" | "requests"
  >("detail");
  const detail = useQuery({
    queryKey: ["instructor-course", courseId, "occurrence", occurrence.id],
    queryFn: async () =>
      parseOccurrence(
        unwrapData(
          await api.getSessionOccurrence(courseId, occurrence.id),
          "class details",
        ),
      ),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const checkpoint = useIdempotencyCheckpoint();
  const cancel = useMutation({
    mutationFn: () => {
      if (detail.data?.version == null)
        throw new LocalizedError("operations:errors.reloadBeforeCancel");
      return checkpoint.run(
        "cancel-occurrence",
        { id: occurrence.id, version: detail.data.version },
        (key, value) =>
          api.cancelSessionOccurrence(courseId, value.id, value.version, key),
      );
    },
    onSuccess: () => onSaved("operations:occurrenceCancelled"),
  });
  if (canManageSchedule && mode === "reschedule" && detail.data)
    return (
      <OccurrenceEditor
        courseId={courseId}
        mode="reschedule"
        occurrence={detail.data}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  return (
    <TeachingDialog
      title={
        mode === "requests"
          ? translate("operations:scheduleRequests")
          : mode === "cancel"
            ? translate("operations:cancelClass")
            : translate("operations:classOccurrence")
      }
      description={dateLabel(occurrence.date)}
      onClose={onClose}
      busy={cancel.isPending}
    >
      {detail.isPending || detail.isError ? (
        <TeachingState
          loading={detail.isPending}
          error={detail.error}
          onRetry={() => void detail.refetch()}
        />
      ) : (
        <>
          {mode === "requests" ? (
            <OccurrenceRequests
              courseId={courseId}
              occurrenceId={occurrence.id}
            />
          ) : (
            <>
              <p>
                {timeRange(detail.data?.startTime, detail.data?.endTime)}
                {detail.data?.timezone ? ` · ${detail.data.timezone}` : ""}
              </p>
              <TeachingBadge value={detail.data?.status} />
              {mode === "cancel" ? (
                <p className={s.notice}>
                  {translate("operations:cancelClassHelp")}</p>
              ) : null}
              {canManageSchedule && detail.data?.version == null ? (
                <p className={s.notice}>
                  {translate("operations:reloadClass")}</p>
              ) : null}
              <TeachingError error={cancel.error} />
              <div className={s.actions}>
                {mode === "cancel" ? (
                  <>
                    <button
                      type="button"
                      className={s.secondary}
                      disabled={cancel.isPending}
                      onClick={() => setMode("detail")}
                    >
                      {translate("operations:keepClass")}</button>
                    <button
                      type="button"
                      className={s.danger}
                      disabled={
                        cancel.isPending || detail.data?.version == null
                      }
                      onClick={() => cancel.mutate()}
                    >
                      {cancel.isPending
                        ? translate("operations:cancelling")
                        : translate("operations:confirmCancellation")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={s.textButton}
                      onClick={() => setMode("requests")}
                    >
                      {translate("operations:scheduleRequests")}</button>
                    {canManageSchedule ? <><button
                      type="button"
                      className={`${s.textButton} ${s.dangerText}`}
                      disabled={detail.data?.version == null}
                      onClick={() => setMode("cancel")}
                    >
                      {translate("operations:cancelOccurrence")}</button>
                    <button
                      type="button"
                      className={s.secondary}
                      disabled={
                        detail.data?.version == null ||
                        detail.data?.attendanceOpened === true
                      }
                      onClick={() => setMode("reschedule")}
                    >
                      {translate("operations:reschedule")}</button></> : null}
                    <button
                      type="button"
                      className={s.primary}
                      onClick={() => onAttendance(occurrence.id)}
                    >
                      <Check size={16} />
                      {translate("operations:takeAttendance")}</button>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </TeachingDialog>
  );
}

function OccurrenceEditor({
  courseId,
  mode,
  occurrence,
  onClose,
  onSaved,
}: {
  courseId: number;
  mode: "create" | "generate" | "reschedule";
  occurrence?: Occurrence;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const {t: translate} = useTranslation();
  const [draft, setDraft] = useState({
    sessionId: occurrence?.sessionId ? String(occurrence.sessionId) : "",
    weekId: occurrence?.weekId ? String(occurrence.weekId) : "",
    date: occurrence?.date ?? "",
    from: "",
    to: "",
    start: occurrence?.startTime?.slice(0, 5) ?? "",
    end: occurrence?.endTime?.slice(0, 5) ?? "",
  });
  const sessions = useCourseSessions(courseId);
  const weeks = useCourseWeeks(courseId);
  const checkpoint = useIdempotencyCheckpoint();
  const title =
    mode === "generate"
      ? "operations:generateClassOccurrences"
      : mode === "reschedule"
        ? "operations:rescheduleClass"
        : "operations:createOccurrence";
  const invalid =
    mode === "generate"
      ? !draft.from || !draft.to || draft.from > draft.to
      : !draft.date || !draft.start || !draft.end || draft.end <= draft.start;
  const mutation = useMutation({
    mutationFn: () =>
      checkpoint.run(
        `${mode}-occurrence`,
        { draft, id: occurrence?.id, version: occurrence?.version },
        async (key, value) => {
          const weekId = value.draft.weekId
            ? Number(value.draft.weekId)
            : undefined;
          if (mode === "generate")
            return api.generateSessionOccurrences(
              courseId,
              { from: draft.from, to: draft.to, weekId },
              key,
            );
          const payload = {
            occurrenceDate: draft.date,
            startTime: `${draft.start}:00`,
            endTime: `${draft.end}:00`,
            weekId,
          };
          if (mode === "reschedule") {
            if (!value.id || value.version == null)
              throw new LocalizedError("operations:errors.reloadBeforeReschedule");
            return api.rescheduleSessionOccurrence(
              courseId,
              value.id,
              { ...payload, expectedVersion: value.version },
              key,
            );
          }
          return api.createSessionOccurrence(
            courseId,
            {
              ...payload,
              sessionId: draft.sessionId ? Number(draft.sessionId) : undefined,
            },
            key,
          );
        },
      ),
    onSuccess: () =>
      onSaved(
        mode === "generate"
          ? "operations:occurrencesGenerated"
          : mode === "reschedule"
            ? "operations:classRescheduled"
            : "operations:occurrenceCreated",
      ),
  });
  return (
    <TeachingDialog
      title={translate(title)}
      description={translate("operations:courseTimesHelp")}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form noValidate
        className={s.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) mutation.mutate();
        }}
      >
        {mode === "generate" ? (
          <>
            <label className={s.field}>
              {translate("operations:from")}<EnglishDateInput
                aria-label={translate("operations:from")}
                required
                value={draft.from}
                onChangeValue={(from) => setDraft({ ...draft, from })}
              />
            </label>
            <label className={s.field}>
              {translate("operations:to")}<EnglishDateInput
                aria-label={translate("operations:to")}
                required
                value={draft.to}
                onChangeValue={(to) => setDraft({ ...draft, to })}
              />
            </label>
            <Link
              className={`${s.textButton} ${s.full}`}
              to={generatePath(APP_ROUTE_PATHS.courseCourseIdSchedule, {
                courseId: String(courseId),
              })}
            >
              {translate("operations:reviewRecurringSchedule")}</Link>
          </>
        ) : (
          <>
            {mode === "create" ? (
              <label className={`${s.field} ${s.full}`}>
                {translate("operations:optionalSession")}<select
                  value={draft.sessionId}
                  onChange={(event) => {
                    const session = sessions.data?.find(
                      (item) => item.id === Number(event.target.value),
                    );
                    setDraft({
                      ...draft,
                      sessionId: event.target.value,
                      start: session?.startTime?.slice(0, 5) ?? draft.start,
                      end: session?.endTime?.slice(0, 5) ?? draft.end,
                    });
                  }}
                >
                  <option value="">{translate("operations:standaloneClass")}</option>
                  {sessions.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.type} · {item.dayOfWeek} ·{" "}
                      {timeRange(item.startTime, item.endTime)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={`${s.field} ${s.full}`}>
              {translate("operations:classDate")}<EnglishDateInput
                aria-label={translate("operations:classDate")}
                required
                value={draft.date}
                onChangeValue={(date) => setDraft({ ...draft, date })}
              />
            </label>
            <label className={s.field}>
              {translate("auth:preview.startTime")}<EnglishTimeInput
                aria-label={translate("auth:preview.startTime")}
                required
                value={draft.start}
                onChangeValue={(start) => setDraft({ ...draft, start })}
              />
            </label>
            <label className={s.field}>
              {translate("operations:endTime")}<EnglishTimeInput
                aria-label={translate("operations:endTime")}
                required
                value={draft.end}
                onChangeValue={(end) => setDraft({ ...draft, end })}
              />
            </label>
          </>
        )}
        <label className={`${s.field} ${s.full}`}>
          {translate("operations:optionalLecture")}<select
            value={draft.weekId}
            onChange={(event) =>
              setDraft({ ...draft, weekId: event.target.value })
            }
          >
            <option value="">{translate("operations:noLecture")}</option>
            {weeks.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        {sessions.isError || weeks.isError ? (
          <div className={s.full}>
            <TeachingError error={sessions.error || weeks.error} />
            <button
              type="button"
              className={s.textButton}
              onClick={() => {
                void sessions.refetch();
                void weeks.refetch();
              }}
            >
              {translate("operations:reloadChoices")}</button>
          </div>
        ) : null}
        <div className={s.full}>
          <TeachingError error={mutation.error} />
          {draft.start && draft.end && draft.end <= draft.start ? (
            <p className={s.error}>{translate("operations:invalidTime")}</p>
          ) : null}
        </div>
        <div className={s.actions}>
          <button
            className={s.secondary}
            type="button"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            {translate("common:actions.cancel")}</button>
          <button
            className={s.primary}
            disabled={invalid || mutation.isPending}
          >
            {mutation.isPending
              ? translate("common:actions.saving")
              : mode === "generate"
                ? translate("operations:generateOccurrences")
                : mode === "reschedule"
                  ? translate("operations:saveNewSchedule")
                  : translate("operations:createOccurrence")}
          </button>
        </div>
      </form>
    </TeachingDialog>
  );
}
