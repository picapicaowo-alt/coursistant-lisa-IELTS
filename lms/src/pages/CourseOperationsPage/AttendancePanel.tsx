import { LocalizedError } from "@/i18n/errors";
import { useTranslation } from "react-i18next";
import { teachingLabel } from "@/components/TeachingWorkspace/presentation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, RefreshCw } from "lucide-react";
import { ATTENDANCE_STATUSES, unwrapData } from "@/apis";
import { courseOperationsApiService as api } from "@/apis/services/course-operations-api";
import { advisorApiService } from "@/apis/services/advisor-api";
import {
  TeachingAvatar,
  TeachingDialog,
  TeachingError,
  TeachingState,
} from "@/components/TeachingWorkspace";
import { RecordSummaryList } from "@/components/RecordSummaryList";
import { useIdempotencyCheckpoint } from "@/hooks/useIdempotencyCheckpoint";
import { isConflict } from "@/utils/apiError";
import {
  useCourseOccurrences,
  useCourseWeeks,
  useRefreshTeaching,
} from "./useCourseRecords";
import {
  dateLabel,
  timeRange,
  operationKeys,
  parseAttendance,
  type AttendanceRoster,
} from "./records";
import { formatNumber } from "@/i18n/formatting";
import { studentRecordLabel } from "./records";
import { occurrenceTitle } from "./records";
import s from "@/components/TeachingWorkspace/index.module.scss";
import local from "./attendance.module.scss";

type EditingState = { dirty: boolean; busy: boolean };
export function AttendancePanel({
  courseId,
  selectedId,
  onSelect,
  onEditing,
}: {
  courseId: number;
  selectedId?: number;
  onSelect: (id: number) => void;
  onEditing: (state: EditingState) => void;
}) {
  const { t: translate } = useTranslation();
  const occurrences = useCourseOccurrences(courseId);
  const weeks = useCourseWeeks(courseId);
  const [epoch, setEpoch] = useState(0);
  const [message, setMessage] = useState("");
  const id = selectedId ?? occurrences.data?.[0]?.id;
  const roster = useQuery({
    queryKey: operationKeys.attendance(courseId, id ?? 0),
    enabled: id != null,
    queryFn: async () =>
      parseAttendance(
        unwrapData(
          await api.getOccurrenceAttendance(courseId, id!),
          "attendance roster",
        ),
      ),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const reload = async () => {
    const result = await roster.refetch();
    if (!result.isError) setEpoch((value) => value + 1);
  };
  return (
    <section
      className={`${s.panel} ${local.attendancePanel}`}
      aria-label={translate("operations:classAttendance")}
    >
      <label className={`${s.field} ${local.sessionPicker}`}>
        {translate("operations:selectSession")}
        <select
          value={id ?? ""}
          onChange={(event) => onSelect(Number(event.target.value))}
          disabled={occurrences.isPending}
        >
          {!occurrences.data?.length ? (
            <option value="">{translate("operations:noSessions")}</option>
          ) : null}
          {occurrences.data?.map((item) => (
            <option value={item.id} key={item.id}>
              {dateLabel(item.date)} · {occurrenceTitle(item, weeks.data)} ·{" "}
              {timeRange(item.startTime, item.endTime)}
            </option>
          ))}
        </select>
      </label>
      {message ? (
        <p className={s.success} role="status">
          {translate(message)}
        </p>
      ) : null}
      {occurrences.isPending || occurrences.isError ? (
        <TeachingState
          loading={occurrences.isPending}
          error={occurrences.error}
          onRetry={() => void occurrences.refetch()}
        />
      ) : id == null ? (
        <TeachingState empty={translate("operations:noAttendanceClass")} />
      ) : roster.isPending || roster.isError ? (
        <TeachingState
          loading={roster.isPending}
          error={roster.error}
          onRetry={() => void roster.refetch()}
        />
      ) : roster.data ? (
        <AttendanceEditor
          key={`${id}-${epoch}`}
          courseId={courseId}
          occurrenceId={id}
          initial={roster.data}
          onReload={reload}
          onEditing={onEditing}
          onSaved={() => setMessage("operations:attendanceSaved")}
        />
      ) : null}
    </section>
  );
}

function AttendanceEditor({
  courseId,
  occurrenceId,
  initial,
  onReload,
  onEditing,
  onSaved,
}: {
  courseId: number;
  occurrenceId: number;
  initial: AttendanceRoster;
  onReload: () => Promise<void>;
  onEditing: (state: EditingState) => void;
  onSaved: () => void;
}) {
  const { t: translate } = useTranslation();
  // Keep the editing snapshot/version together. A background refetch cannot overwrite unsaved choices.
  const [snapshot] = useState(initial);
  const [changes, setChanges] = useState<Record<number, string>>({});
  const [student, setStudent] = useState<{ id: number; name: string }>();
  const [needsReload, setNeedsReload] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const checkpoint = useIdempotencyCheckpoint();
  const refresh = useRefreshTeaching(courseId);
  const entries = Object.entries(changes).map(([studentUserId, status]) => ({
    studentUserId: Number(studentUserId),
    status,
  }));
  const save = useMutation({
    mutationFn: () => {
      if (snapshot.version == null)
        throw new LocalizedError("operations:errors.reloadAttendance");
      return checkpoint.run(
        "save-attendance",
        { entries, expectedAttendanceVersion: snapshot.version },
        (key, payload) =>
          api.saveOccurrenceAttendance(courseId, occurrenceId, payload, key),
      );
    },
    onSuccess: async () => {
      setNeedsReload(true);
      setChanges({});
      onSaved();
      await refresh();
      await onReload();
    },
    onError: (error) => setNeedsReload(isConflict(error)),
  });
  const sync = useMutation({
    mutationFn: () =>
      checkpoint.run("sync-attendance", { courseId, occurrenceId }, (key) =>
        api.syncOccurrenceAttendanceRoster(courseId, occurrenceId, key),
      ),
    onSuccess: async () => {
      setNeedsReload(true);
      await onReload();
    },
  });
  const counts = snapshot.items.reduce<Record<string, number>>(
    (result, item) => {
      const status = changes[item.studentUserId] ?? item.status ?? "UNRECORDED";
      result[status] = (result[status] ?? 0) + 1;
      return result;
    },
    {},
  );
  const busy = save.isPending || sync.isPending;
  useEffect(() => {
    onEditing({ dirty: entries.length > 0, busy });
  }, [entries.length, busy, onEditing]);
  useEffect(() => () => onEditing({ dirty: false, busy: false }), [onEditing]);
  return (
    <>
      <div className={local.actionBar}>
        <span className={s.muted}>
          {entries.length
            ? translate("operations:unsavedChanges", {
                count: entries.length,
                number: formatNumber(entries.length),
              })
            : translate("operations:selectedAttendance")}
        </span>
        <div className={s.toolbarGroup}>
          <button
            type="button"
            className={s.secondary}
            disabled={busy}
            onClick={() =>
              entries.length ? setConfirmReload(true) : sync.mutate()
            }
          >
            <RefreshCw size={18} />
            {translate("operations:syncRoster")}
          </button>
          <button
            type="button"
            className={s.primary}
            disabled={
              busy || !entries.length || needsReload || snapshot.version == null
            }
            onClick={() => save.mutate()}
          >
            <Check size={18} />
            {save.isPending
              ? translate("common:actions.saving")
              : translate("operations:saveAttendance")}
          </button>
        </div>
      </div>
      <div className={local.metrics}>
        {[
          {
            labelKey: "operations:totalRoster",
            value: snapshot.items.length,
            status: "",
          },
          {
            labelKey: "common:status.PRESENT",
            value: counts.PRESENT ?? 0,
            status: "PRESENT",
          },
          {
            labelKey: "operations:lateArrivals",
            value: counts.LATE ?? 0,
            status: "LATE",
          },
          {
            labelKey: "common:status.ABSENT",
            value: counts.ABSENT ?? 0,
            status: "ABSENT",
          },
        ].map((item) => (
          <div key={item.labelKey} data-status={item.status}>
            <span>{translate(item.labelKey)}</span>
            <strong>
              {formatNumber(item.value)}
              {!item.status ? (
                <small> {translate("common:people.students")}</small>
              ) : null}
            </strong>
          </div>
        ))}
      </div>
      {(counts.UNRECORDED ?? 0) > 0 || (counts.EXCUSED ?? 0) > 0 ? (
        <p className={s.muted}>
          {translate("operations:attendanceCounts", {
            unrecorded: formatNumber(counts.UNRECORDED ?? 0),
            excused: formatNumber(counts.EXCUSED ?? 0),
          })}
        </p>
      ) : null}
      <TeachingError error={save.error || sync.error} />
      {needsReload || snapshot.version == null ? (
        <div className={s.notice}>
          {translate("operations:reloadAttendanceHelp")}
          <button
            type="button"
            className={s.textButton}
            onClick={() => setConfirmReload(true)}
          >
            {translate("operations:reloadRoster")}
          </button>
        </div>
      ) : null}
      {!snapshot.items.length ? (
        <TeachingState empty={translate("operations:noAttendanceStudents")} />
      ) : (
        <div className={s.tableWrap}>
          <table className={`${s.table} ${local.roster}`}>
            <thead>
              <tr>
                <th>{translate("operations:studentInformation")}</th>
                <th>{translate("operations:attendanceStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.items.map((item) => {
                const status = changes[item.studentUserId] ?? item.status;
                return (
                  <tr key={item.studentUserId}>
                    <td>
                      <div className={s.person}>
                        <TeachingAvatar name={studentRecordLabel(item)} />
                        <div>
                          <button
                            type="button"
                            className={local.studentName}
                            onClick={() =>
                              setStudent({
                                id: item.studentUserId,
                                name: item.name,
                              })
                            }
                          >
                            {studentRecordLabel(item)}
                          </button>
                          <small className={s.subline}>
                            {status
                              ? teachingLabel(status)
                              : translate("operations:notRecorded")}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div
                        className={local.statusToggle}
                        role="group"
                        aria-label={translate("operations:attendanceFor", {
                          name: studentRecordLabel(item),
                        })}
                      >
                        {ATTENDANCE_STATUSES.map((value) => (
                          <button
                            type="button"
                            key={value}
                            aria-pressed={status === value}
                            data-status={value}
                            disabled={busy}
                            onClick={() =>
                              setChanges((current) => {
                                const next = { ...current };
                                if (item.status === value)
                                  delete next[item.studentUserId];
                                else next[item.studentUserId] = value;
                                return next;
                              })
                            }
                          >
                            {teachingLabel(value)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {confirmReload ? (
        <TeachingDialog
          title={translate("operations:reloadAttendance")}
          description={translate("operations:discardAttendanceHelp")}
          onClose={() => setConfirmReload(false)}
          busy={busy}
        >
          <div className={s.actions}>
            <button
              type="button"
              className={s.secondary}
              onClick={() => setConfirmReload(false)}
            >
              {translate("operations:keepEditing")}
            </button>
            <button
              type="button"
              className={s.primary}
              onClick={() => {
                setConfirmReload(false);
                sync.mutate();
              }}
            >
              {translate("operations:reloadSync")}
            </button>
          </div>
        </TeachingDialog>
      ) : null}
      {student ? (
        <StudentContext
          courseId={courseId}
          student={student}
          onClose={() => setStudent(undefined)}
        />
      ) : null}
    </>
  );
}

function StudentContext({
  courseId,
  student,
  onClose,
}: {
  courseId: number;
  student: { id: number; name: string };
  onClose: () => void;
}) {
  const { t: translate } = useTranslation();
  const query = useQuery({
    queryKey: ["instructor-student-context", courseId, student.id],
    queryFn: async () =>
      unwrapData(
        await advisorApiService.getInstructorStudentProfileContext(
          courseId,
          student.id,
        ),
        "student teaching context",
      ),
    retry: false,
  });
  return (
    <TeachingDialog
      title={studentRecordLabel({
        studentUserId: student.id,
        name: student.name,
      })}
      description={translate("operations:sharedTeachingContext")}
      onClose={onClose}
    >
      {query.isPending || query.isError ? (
        <TeachingState
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <RecordSummaryList
          value={query.data}
          emptyMessage={translate("operations:noTeachingContext")}
        />
      )}
    </TeachingDialog>
  );
}
