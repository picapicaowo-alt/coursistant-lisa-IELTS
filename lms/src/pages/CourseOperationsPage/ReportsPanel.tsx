import { LocalizedError } from "@/i18n/errors";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { unwrapData, type UpsertCourseStudentReportRequest } from "@/apis";
import { courseOperationsApiService as api } from "@/apis/services/course-operations-api";
import {
  TeachingAvatar,
  TeachingBadge,
  TeachingDialog,
  TeachingError,
  TeachingPagination,
  TeachingState,
} from "@/components/TeachingWorkspace";
import { useIdempotencyCheckpoint } from "@/hooks/useIdempotencyCheckpoint";
import { getApiErrorCode, isConflict } from "@/utils/apiError";
import {
  CourseStudentPicker,
  type SelectedStudent,
} from "./CourseStudentPicker";
import {
  PAGE_SIZE,
  REPORT_TYPES,
  REPORT_STATUSES,
  operationKeys,
  recordPage,
  parseReport,
  dateLabel,
  type StudentReport,
} from "./records";
import s from "@/components/TeachingWorkspace/index.module.scss";

const reportKey = (courseId: number, reportId: number) => [
  ...operationKeys.reports(courseId),
  reportId,
];
import i18n from "@/i18n";
import { studentRecordLabel } from "./records";

const reportLabel = (type?: string) =>
  i18n.t(
    REPORT_TYPES.find((item) => item.value === type)?.labelKey ??
      "operations:studentReport",
  );
const FIELDS = [
  { key: "overallSummary", labelKey: "operations:overallSummary" },
  { key: "strengths", labelKey: "operations:strengths" },
  { key: "weaknesses", labelKey: "operations:areasForImprovement" },
  { key: "skillEvaluation", labelKey: "operations:skillEvaluation" },
  { key: "improvementSuggestions", labelKey: "operations:nextSteps" },
] as const;

export function ReportsPanel({ courseId }: { courseId: number }) {
  const { t: translate } = useTranslation();
  const [student, setStudent] = useState<SelectedStudent>();
  const [type, setType] = useState<"" | "MID_TERM" | "FINAL">("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<{
    id?: number;
    mode: "create" | "view" | "edit" | "publish";
  }>();
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [
      ...operationKeys.reports(courseId),
      "list",
      student?.id,
      type,
      status,
      page,
    ],
    queryFn: async () => {
      const response = recordPage(
        unwrapData(
          await api.listCourseStudentReports(courseId, {
            studentUserId: student?.id,
            reportType: type || undefined,
            status: status || undefined,
            page: page + 1,
            size: PAGE_SIZE,
          }),
          "student reports",
        ),
      );
      return { ...response, items: response.items.map(parseReport) };
    },
    retry: false,
  });
  const finish = async (text: string) => {
    setEditor(undefined);
    setMessage(text);
    await client.invalidateQueries({
      queryKey: operationKeys.reports(courseId),
    });
  };
  return (
    <section
      className={s.panel}
      aria-label={translate("operations:studentReports")}
    >
      <div className={s.toolbar}>
        <div className={s.toolbarGroup}>
          <CourseStudentPicker
            courseId={courseId}
            selected={student}
            onSelect={(value) => {
              setStudent(value);
              setPage(0);
            }}
          />
          <select
            className={s.select}
            aria-label={translate("operations:reportType")}
            value={type}
            onChange={(event) => {
              setType(
                REPORT_TYPES.find((item) => item.value === event.target.value)
                  ?.value ?? "",
              );
              setPage(0);
            }}
          >
            <option value="">{translate("operations:allTypes")}</option>
            {REPORT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {translate(item.labelKey)}
              </option>
            ))}
          </select>
          <select
            className={s.select}
            aria-label={translate("operations:reportStatus")}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <option value="">{translate("operations:allStatuses")}</option>
            {REPORT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item === "DRAFT"
                  ? translate("common:status.DRAFT")
                  : translate("common:status.PUBLISHED")}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={s.primary}
          onClick={() => setEditor({ mode: "create" })}
        >
          <Plus size={18} />
          {translate("operations:createNewReport")}
        </button>
      </div>
      {message ? (
        <p className={s.success} role="status">
          {translate(message)}
        </p>
      ) : null}
      {query.isPending || query.isError || !query.data?.items.length ? (
        <TeachingState
          loading={query.isPending}
          error={query.error}
          empty={translate("operations:noReportMatches")}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className={s.recordList}>
          {query.data.items.map((item) => (
            <ReportCard
              key={item.id}
              courseId={courseId}
              report={item}
              onOpen={(mode) => setEditor({ id: item.id, mode })}
            />
          ))}
        </div>
      )}
      <TeachingPagination
        page={page}
        size={PAGE_SIZE}
        count={query.data?.items.length ?? 0}
        total={query.data?.total}
        loading={query.isFetching}
        onChange={setPage}
        label={translate("navigation:parent.reports")}
      />
      {editor ? (
        <ReportDialog
          key={`${editor.id}-${editor.mode}`}
          courseId={courseId}
          reportId={editor.id}
          mode={editor.mode}
          student={student}
          onClose={() => setEditor(undefined)}
          onSaved={finish}
        />
      ) : null}
    </section>
  );
}

function ReportCard({
  courseId,
  report,
  onOpen,
}: {
  courseId: number;
  report: StudentReport;
  onOpen: (mode: "view" | "edit" | "publish") => void;
}) {
  const { t: translate } = useTranslation();
  // Summary responses intentionally omit narrative fields. Use the shared detail cache, not invented excerpts.
  const detail = useQuery({
    queryKey: reportKey(courseId, report.id),
    queryFn: async () =>
      parseReport(
        unwrapData(
          await api.getCourseStudentReport(courseId, report.id),
          "report preview",
        ),
      ),
    retry: false,
    refetchOnWindowFocus: false,
  });
  return (
    <article className={s.record}>
      <div className={s.recordHeader}>
        <div className={s.person}>
          <TeachingAvatar name={studentRecordLabel(report)} />
          <div>
            <h3>{studentRecordLabel(report)}</h3>
            <small className={s.subline}>
              {reportLabel(report.reportType)} ·{" "}
              {translate("common:feedback.updatedAt", {
                time: dateLabel(report.updatedAt),
              })}
            </small>
          </div>
        </div>
        <div className={s.recordActions}>
          <TeachingBadge value={report.status} />
          {report.status === "DRAFT" ? (
            <button
              className={s.textButton}
              type="button"
              onClick={() => onOpen("edit")}
            >
              {translate("common:actions.edit")}
            </button>
          ) : null}
          <button
            className={s.textButton}
            type="button"
            onClick={() => onOpen("view")}
          >
            {translate("common:actions.view")}
          </button>
          {report.status === "DRAFT" ? (
            <button
              className={s.textButton}
              type="button"
              onClick={() => onOpen("publish")}
            >
              {translate("course:addContent.publishButton")}
            </button>
          ) : null}
        </div>
      </div>
      <p className={s.preview}>
        {detail.isPending
          ? translate("operations:loadingSummary")
          : detail.isError
            ? translate("operations:summaryUnavailable")
            : detail.data?.overallSummary || translate("operations:noSummary")}
      </p>
    </article>
  );
}

function ReportDialog({
  courseId,
  reportId,
  mode,
  student,
  onClose,
  onSaved,
}: {
  courseId: number;
  reportId?: number;
  mode: "create" | "view" | "edit" | "publish";
  student?: SelectedStudent;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const { t: translate } = useTranslation();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: reportKey(courseId, reportId ?? 0),
    queryFn: async () =>
      parseReport(
        unwrapData(
          await api.getCourseStudentReport(courseId, reportId!),
          "student report",
        ),
      ),
    enabled: reportId != null,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const title =
    mode === "create"
      ? "operations:createStudentReport"
      : mode === "publish"
        ? "operations:publishStudentReport"
        : mode === "edit"
          ? "operations:editStudentReport"
          : "operations:studentReport";
  return (
    <TeachingDialog
      title={translate(title)}
      description={
        query.data
          ? `${studentRecordLabel(query.data)} · ${reportLabel(query.data.reportType)}`
          : translate("operations:reportWritingHelp")
      }
      onClose={onClose}
      busy={busy}
    >
      {reportId && (query.isPending || query.isError || query.isFetching) ? (
        <TeachingState
          loading={query.isPending || query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ReportEditor
          courseId={courseId}
          mode={mode}
          initial={query.data}
          student={student}
          onClose={onClose}
          onSaved={onSaved}
          onBusy={setBusy}
        />
      )}
    </TeachingDialog>
  );
}

function ReportEditor({
  courseId,
  mode,
  initial,
  student: defaultStudent,
  onClose,
  onSaved,
  onBusy,
}: {
  courseId: number;
  mode: "create" | "view" | "edit" | "publish";
  initial?: StudentReport;
  student?: SelectedStudent;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const { t: translate } = useTranslation();
  const [student, setStudent] = useState(defaultStudent);
  const [snapshot] = useState(initial);
  const [draft, setDraft] = useState<UpsertCourseStudentReportRequest>({
    reportType:
      REPORT_TYPES.find((item) => item.value === initial?.reportType)?.value ??
      "MID_TERM",
    overallSummary: initial?.overallSummary ?? "",
    strengths: initial?.strengths ?? "",
    weaknesses: initial?.weaknesses ?? "",
    skillEvaluation: initial?.skillEvaluation ?? "",
    improvementSuggestions: initial?.improvementSuggestions ?? "",
  });
  const [conflict, setConflict] = useState(false);
  const checkpoint = useIdempotencyCheckpoint();
  const readOnly =
    mode === "view" || (initial != null && initial.status !== "DRAFT");
  const mutation = useMutation({
    mutationFn: () => {
      if (mode === "create" && !student)
        throw new LocalizedError("operations:errors.chooseStudent");
      if (
        mode !== "create" &&
        (!snapshot || snapshot.version == null || snapshot.status !== "DRAFT")
      )
        throw new LocalizedError("operations:errors.currentDraftOnly");
      const payload =
        mode === "create"
          ? { ...draft, studentUserId: student?.id }
          : { ...draft, expectedVersion: snapshot?.version };
      return checkpoint.run(
        `${mode}-report`,
        { id: snapshot?.id, payload },
        async (key, value) => {
          if (mode === "publish")
            return api.publishCourseStudentReport(
              courseId,
              snapshot!.id,
              snapshot!.version,
              key,
            );
          if (mode === "create")
            return api.createCourseStudentReport(courseId, value.payload, key);
          return api.updateCourseStudentReport(
            courseId,
            snapshot!.id,
            value.payload,
            key,
          );
        },
      );
    },
    onMutate: () => onBusy(true),
    onSettled: () => onBusy(false),
    onSuccess: () =>
      onSaved(
        mode === "publish"
          ? "operations:reportPublished"
          : "operations:reportDraftSaved",
      ),
    onError: (error) =>
      setConflict(
        isConflict(error) ||
          getApiErrorCode(error) === "COURSE_REPORT_PUBLISHED_READONLY",
      ),
  });
  if (readOnly || mode === "publish")
    return (
      <div>
        <TeachingBadge value={initial?.status} />
        {FIELDS.map((field) => (
          <section key={field.key} className={s.notice}>
            <h3>{translate(field.labelKey)}</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {initial?.[field.key] || translate("common:feedback.notProvided")}
            </p>
          </section>
        ))}
        {mode === "publish" && !readOnly ? (
          <p className={s.notice}>
            {translate("operations:publishReadOnlyHelp")}
          </p>
        ) : null}
        <TeachingError error={mutation.error} />
        <div className={s.actions}>
          <button
            type="button"
            className={s.secondary}
            disabled={mutation.isPending}
            onClick={onClose}
          >
            {translate("common:actions.close")}
          </button>
          {mode === "publish" && !readOnly ? (
            <button
              type="button"
              className={s.primary}
              disabled={
                mutation.isPending || conflict || initial?.version == null
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? translate("operations:publishing")
                : translate("operations:confirmPublication")}
            </button>
          ) : null}
        </div>
      </div>
    );
  return (
    <form
      className={s.form}
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      {mode === "create" ? (
        <div className={`${s.field} ${s.full}`}>
          <span>{translate("common:roles.STUDENT")}</span>
          <CourseStudentPicker
            courseId={courseId}
            selected={student}
            onSelect={setStudent}
          />
        </div>
      ) : null}
      <label className={`${s.field} ${s.full}`}>
        {translate("operations:reportType")}
        <select
          value={draft.reportType}
          onChange={(event) => {
            const type = REPORT_TYPES.find(
              (item) => item.value === event.target.value,
            );
            if (type) setDraft({ ...draft, reportType: type.value });
          }}
        >
          {REPORT_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {translate(item.labelKey)}
            </option>
          ))}
        </select>
      </label>
      {FIELDS.map((field) => (
        <label className={`${s.field} ${s.full}`} key={field.key}>
          {translate(field.labelKey)}
          <textarea
            value={draft[field.key]}
            onChange={(event) =>
              setDraft({ ...draft, [field.key]: event.target.value })
            }
          />
        </label>
      ))}
      <div className={s.full}>
        <TeachingError error={mutation.error} />
        {conflict ? (
          <p className={s.notice}>{translate("operations:reloadReport")}</p>
        ) : null}
      </div>
      <div className={s.actions}>
        <button
          type="button"
          className={s.secondary}
          disabled={mutation.isPending}
          onClick={onClose}
        >
          {translate("common:actions.cancel")}
        </button>
        <button
          className={s.primary}
          disabled={
            mutation.isPending ||
            conflict ||
            (mode === "create" ? !student : snapshot?.version == null)
          }
        >
          {mutation.isPending
            ? translate("common:actions.saving")
            : translate("operations:saveDraft")}
        </button>
      </div>
    </form>
  );
}
