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
}: {
  courseId: number;
  onAttendance: (id: number) => void;
}) {
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
    <section className={s.panel} aria-label="Session occurrences">
      <div className={s.toolbar}>
        <div className={s.toolbarGroup}>
          <button
            className={s.secondary}
            type="button"
            aria-expanded={showDates}
            onClick={() => setShowDates(!showDates)}
          >
            <CalendarDays size={18} />
            {range.from || range.to ? "Custom dates" : "All dates"}
          </button>
          <label className={s.field}>
            <span className={s.subline}>Include history</span>
            <input
              type="checkbox"
              checked={range.history}
              onChange={(event) =>
                setRange({ ...range, history: event.target.checked })
              }
            />
          </label>
        </div>
        <div className={s.toolbarGroup}>
          <button
            className={s.secondary}
            type="button"
            onClick={() => setEditor({ kind: "generate" })}
          >
            <RefreshCw size={16} />
            Generate from schedule
          </button>
          <button
            className={s.primary}
            type="button"
            onClick={() => setEditor({ kind: "create" })}
          >
            <Plus size={18} />
            Create occurrence
          </button>
        </div>
      </div>
      {showDates ? (
        <div className={s.toolbar}>
          <label className={s.field}>
            From
            <EnglishDateInput
              value={range.from}
              onChangeValue={(from) => setRange({ ...range, from })}
            />
          </label>
          <label className={s.field}>
            To
            <EnglishDateInput
              value={range.to}
              onChangeValue={(to) => setRange({ ...range, to })}
            />
          </label>
          <button
            type="button"
            className={s.textButton}
            onClick={() => setRange({ ...range, from: "", to: "" })}
          >
            Clear dates
          </button>
        </div>
      ) : null}
      {saved ? (
        <p role="status" className={s.success}>
          {saved}
        </p>
      ) : null}
      {query.isPending || query.isError || !query.data?.length ? (
        <TeachingState
          loading={query.isPending}
          error={query.error}
          empty="No class occurrences in this date range. Create a class or generate dates from your teaching schedule."
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className={s.tableWrap}>
          <table className={`${s.table} ${s.responsive}`}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Session</th>
                <th>Lecture</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((item) => (
                <tr key={item.id}>
                  <td data-label="Date">
                    <strong>{dateLabel(item.date)}</strong>
                  </td>
                  <td data-label="Time">
                    <span className={s.muted}>
                      {timeRange(item.startTime, item.endTime)}
                      {item.timezone ? (
                        <small className={s.subline}>{item.timezone}</small>
                      ) : null}
                    </span>
                  </td>
                  <td data-label="Session">
                    <span>{occurrenceTitle(item, weeks.data)}</span>
                  </td>
                  <td data-label="Lecture">
                    <span className={s.muted}>
                      {item.weekId
                        ? `Lecture ${weeks.data?.find((week) => week.id === item.weekId)?.lectureNumber ?? item.weekId}`
                        : "Not linked"}
                    </span>
                  </td>
                  <td data-label="Status">
                    <TeachingBadge value={item.status} />
                  </td>
                  <td data-label="Actions">
                    <button
                      type="button"
                      className={s.iconButton}
                      aria-label={`Manage ${dateLabel(item.date)} class`}
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
        />
      ) : editor ? (
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
}: {
  courseId: number;
  occurrence: Occurrence;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  onAttendance: (id: number) => void;
}) {
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
        throw new Error(
          "The current class version is unavailable. Reload before cancelling.",
        );
      return checkpoint.run(
        "cancel-occurrence",
        { id: occurrence.id, version: detail.data.version },
        (key, value) =>
          api.cancelSessionOccurrence(courseId, value.id, value.version, key),
      );
    },
    onSuccess: () => onSaved("Class occurrence cancelled."),
  });
  if (mode === "reschedule" && detail.data)
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
          ? "Schedule requests"
          : mode === "cancel"
            ? "Cancel this class?"
            : "Class occurrence"
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
                  This cancels only this dated class. The recurring schedule and
                  other classes are kept.
                </p>
              ) : null}
              {detail.data?.version == null ? (
                <p className={s.notice}>
                  The server did not provide the version needed for a safe
                  schedule change.
                </p>
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
                      Keep class
                    </button>
                    <button
                      type="button"
                      className={s.danger}
                      disabled={
                        cancel.isPending || detail.data?.version == null
                      }
                      onClick={() => cancel.mutate()}
                    >
                      {cancel.isPending
                        ? "Cancelling…"
                        : "Confirm cancellation"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={s.textButton}
                      onClick={() => setMode("requests")}
                    >
                      Schedule requests
                    </button>
                    <button
                      type="button"
                      className={`${s.textButton} ${s.dangerText}`}
                      disabled={detail.data?.version == null}
                      onClick={() => setMode("cancel")}
                    >
                      Cancel occurrence
                    </button>
                    <button
                      type="button"
                      className={s.secondary}
                      disabled={
                        detail.data?.version == null ||
                        detail.data?.attendanceOpened === true
                      }
                      onClick={() => setMode("reschedule")}
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      className={s.primary}
                      onClick={() => onAttendance(occurrence.id)}
                    >
                      <Check size={16} />
                      Take attendance
                    </button>
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
      ? "Generate class occurrences"
      : mode === "reschedule"
        ? "Reschedule class"
        : "Create occurrence";
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
              throw new Error("Reload the latest class before rescheduling.");
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
          ? "Occurrences generated from the recurring schedule."
          : mode === "reschedule"
            ? "Class rescheduled."
            : "Class occurrence created.",
      ),
  });
  return (
    <TeachingDialog
      title={title}
      description="Times follow the course schedule. Instructor availability is checked before the change is saved."
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className={s.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) mutation.mutate();
        }}
      >
        {mode === "generate" ? (
          <>
            <label className={s.field}>
              From
              <EnglishDateInput
                aria-label="From"
                required
                value={draft.from}
                onChangeValue={(from) => setDraft({ ...draft, from })}
              />
            </label>
            <label className={s.field}>
              To
              <EnglishDateInput
                aria-label="To"
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
              Review recurring teaching schedule
            </Link>
          </>
        ) : (
          <>
            {mode === "create" ? (
              <label className={`${s.field} ${s.full}`}>
                Recurring session (optional)
                <select
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
                  <option value="">Standalone class</option>
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
              Class date
              <EnglishDateInput
                aria-label="Class date"
                required
                value={draft.date}
                onChangeValue={(date) => setDraft({ ...draft, date })}
              />
            </label>
            <label className={s.field}>
              Start time
              <EnglishTimeInput
                aria-label="Start time"
                required
                value={draft.start}
                onChangeValue={(start) => setDraft({ ...draft, start })}
              />
            </label>
            <label className={s.field}>
              End time
              <EnglishTimeInput
                aria-label="End time"
                required
                value={draft.end}
                onChangeValue={(end) => setDraft({ ...draft, end })}
              />
            </label>
          </>
        )}
        <label className={`${s.field} ${s.full}`}>
          Lecture (optional)
          <select
            value={draft.weekId}
            onChange={(event) =>
              setDraft({ ...draft, weekId: event.target.value })
            }
          >
            <option value="">No lecture linked</option>
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
              Reload choices
            </button>
          </div>
        ) : null}
        <div className={s.full}>
          <TeachingError error={mutation.error} />
          {draft.start && draft.end && draft.end <= draft.start ? (
            <p className={s.error}>End time must be later than start time.</p>
          ) : null}
        </div>
        <div className={s.actions}>
          <button
            className={s.secondary}
            type="button"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={s.primary}
            disabled={invalid || mutation.isPending}
          >
            {mutation.isPending
              ? "Saving…"
              : mode === "generate"
                ? "Generate occurrences"
                : mode === "reschedule"
                  ? "Save new schedule"
                  : "Create occurrence"}
          </button>
        </div>
      </form>
    </TeachingDialog>
  );
}
