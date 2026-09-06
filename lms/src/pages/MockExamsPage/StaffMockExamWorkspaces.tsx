import {formatNumber, formatDateValue} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import {formatPersonName} from '@/utils/personName';
import { useTranslation } from 'react-i18next';
import {WritingGradeReview} from "./WritingGradeReview";
import { WorkspaceSection } from "@/components/WorkspaceSection";
import { ObserverMockExams } from "@/components/ObserverMockExams";
import { AdvisorInstructorPicker } from "@/components/AdvisorInstructorPicker";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleCheck,
  TextCursor,
  Headphones,
  Image as ImageIcon,
  Check,
  ChevronDown,
  FileText,
  Inbox,
  UserRound,
} from "lucide-react";
import { unwrapData } from "@/apis";
import { advisorApiService } from "@/apis/services/advisor-api";
import { mockExamApiService } from "@/apis/services/mock-exam-api";
import { RecordSummaryList } from "@/components/RecordSummaryList";
import { advisingErrorMessage } from "../advising/advisingErrors";
import {
  recordLabel,
  runtimeItems,
  runtimeNumber,
  runtimeString,
  templateItems,
  type RuntimeRecord,
} from "./staffRuntime";
import styles from "./staff.module.scss";
import assignStyles from "./assign.module.scss";
import {
  useIdempotencyCheckpoint,
} from "@/hooks/useIdempotencyCheckpoint";

type Section = "listening" | "reading" | "writing";

const EXAM_SECTIONS: Section[] = ['listening', 'reading', 'writing'];

function ErrorNotice({
  error,
  fallback,
}: {
  error: unknown;
  fallback: string;
}) {
  return error ? (
    <p className={styles.error} role="alert">
      {advisingErrorMessage(error, fallback)}
    </p>
  ) : null;
}

function idFrom(record: RuntimeRecord, ...keys: string[]): number | null {
  return runtimeNumber(record, ...keys, "id");
}

function nestedRecords(value: unknown, key: string): RuntimeRecord[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const nested = (value as RuntimeRecord)[key];
  return Array.isArray(nested)
    ? nested.filter(
        (item): item is RuntimeRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

type MediaState = { loading?: boolean; url?: string; error?: unknown };

type SectionMediaProps = {section: Section; value: unknown} & (
  {scope?: 'tenant'; templateId: number; versionId: number} | {scope: 'system'; testId: number}
);

export function ExamSectionMedia(props: SectionMediaProps) {
  const { t: translate } = useTranslation();
  const {section, value} = props;
  const audio = (seq: number) => props.scope === 'system' ? mockExamApiService.getSystemListeningAudio(props.testId, seq) : mockExamApiService.getTenantListeningAudio(props.templateId, props.versionId, seq);
  const readingImage = (passage: number, question: number) => props.scope === 'system' ? mockExamApiService.getSystemReadingImage(props.testId, passage, question) : mockExamApiService.getTenantReadingImage(props.templateId, props.versionId, passage, question);
  const writingImage = (seq: number) => props.scope === 'system' ? mockExamApiService.getSystemWritingImage(props.testId, seq) : mockExamApiService.getTenantWritingImage(props.templateId, props.versionId, seq);
  const [media, setMedia] = useState<Record<string, MediaState>>({});
  const objectUrls = useRef(new Set<string>());

  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    },
    [],
  );

  const loadMedia = async (key: string, request: () => Promise<Blob>) => {
    setMedia((current) => ({ ...current, [key]: { loading: true } }));
    try {
      const blob = await request();
      const url = URL.createObjectURL(blob);
      objectUrls.current.add(url);
      setMedia((current) => ({ ...current, [key]: { url } }));
    } catch (error) {
      setMedia((current) => ({
        ...current,
        [key]: {
          error,
        },
      }));
    }
  };

  // Only server-provided sequence identifiers address protected media.
  const items = section === 'listening'
    ? nestedRecords(value, 'parts').flatMap(part => {
      const seq = runtimeNumber(part, 'seq');
      return seq == null || part.hasAudio === false ? [] : [{key: `listening-${seq}`, label: runtimeString(part, 'label') || translate('common:admin.listeningPart', {seq: formatNumber(seq)}), type: 'audio' as const, load: () => audio(seq)}];
    })
    : section === 'reading'
      ? nestedRecords(value, 'passages').flatMap(passage => {
        const passageSeq = runtimeNumber(passage, 'seq');
        if (passageSeq == null) return [];
        return nestedRecords(passage, 'questions').flatMap(question => {
          const sortOrder = runtimeNumber(question, 'sortOrder');
          return sortOrder == null || !(question.hasImage === true || runtimeString(question, 'imageSrc')) ? [] : [{key: `reading-${passageSeq}-${sortOrder}`, label: runtimeString(question, 'title') || translate('common:admin.passageGroup', {passage: formatNumber(passageSeq), group: formatNumber(sortOrder)}), type: 'image' as const, load: () => readingImage(passageSeq, sortOrder)}];
        });
      })
      : nestedRecords(value, 'tasks').flatMap(task => {
        const seq = runtimeNumber(task, 'seq');
        return seq == null || !(task.hasImage === true || runtimeString(task, 'imageSrc')) ? [] : [{key: `writing-${seq}`, label: runtimeString(task, 'title') || translate('common:admin.writingTask', {seq: formatNumber(seq)}), type: 'image' as const, load: () => writingImage(seq)}];
      });

  if (!items.length) return null;

  return (
    <section
      className={styles.mediaReview}
      aria-label={translate('common:admin.sectionMedia', {section: translate(`common:admin.examSections.${section}`)})}
    >
      <div>
        <h4>{translate('common:admin.protectedMedia')}</h4>
        <p>{translate('common:admin.mediaHelp')}</p>
      </div>
      <div className={styles.mediaList}>
        {items.map((item) => {
          const state = media[item.key];
          return (
            <article key={item.key}>
              <div>
                <strong>{item.label}</strong>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={state?.loading}
                  onClick={() => void loadMedia(item.key, item.load)}
                >
                  {item.type === "audio" ? (
                    <Headphones size={16} />
                  ) : (
                    <ImageIcon size={16} />
                  )}{" "}
                  {state?.loading
                    ? translate("common:feedback.loading")
                    : state?.url
                      ? translate('common:admin.reloadMedia')
                      : item.type === "audio"
                        ? translate('common:admin.loadAudio')
                        : translate('common:admin.loadImage')}
                </button>
              </div>
              {state?.url && item.type === "audio" ? (
                <audio controls preload="none" src={state.url}>
                  {translate('common:admin.audioUnsupported')}
                </audio>
              ) : null}
              {state?.url && item.type === "image" ? (
                <img src={state.url} alt={translate('common:admin.mediaReference', {label: item.label})} />
              ) : null}
              {state?.error ? <p role="alert">{advisingErrorMessage(state.error, translate('common:admin.mediaFailed'))}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function AdvisorWorkspace({ value }: { value: unknown }) {
  const { t: translate } = useTranslation();
  const queryClient = useQueryClient();
  const templates = templateItems(value).filter(
    (item) => item.publishedVersionId || item.publishedVersionNo,
  );
  const idempotency = useIdempotencyCheckpoint();
  const students = useQuery({
    queryKey: ["advisor", "students", "mock-exam-assignment"],
    retry: false,
    queryFn: async () =>
      unwrapData(await advisorApiService.listAllStudents(), "advisorStudents"),
  });
  const studentRows = students.data ?? [];
  const [studentId, setStudentId] = useState("");
  const [assignmentCount, setAssignmentCount] = useState<number>();
  const [templateId, setTemplateId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [sections, setSections] = useState<Record<Section, boolean>>({
    listening: true,
    reading: true,
    writing: true,
  });
  const selectedTemplate = useQuery({
    queryKey: ["mock-exams", "advisor", "template", templateId],
    enabled: Number(templateId) > 0,
    queryFn: async () =>
      unwrapData(
        await mockExamApiService.getAdvisorTemplate(Number(templateId)),
        "advisorMockTemplate",
      ),
    retry: false,
  });
  const assign = useMutation({
    mutationFn: () => {
      const request = {
        templateId: Number(templateId),
        listeningSelected: sections.listening,
        readingSelected: sections.reading,
        writingSelected: sections.writing,
        writingInstructorUserId:
          sections.writing && instructorId ? Number(instructorId) : undefined,
      };
      return idempotency.run(
        `assign-mock-exam-${studentId}`,
        request,
        (key, payload) =>
          mockExamApiService.createAdvisorStudentExam(
            Number(studentId),
            payload,
            key,
          ),
      );
    },
    onSuccess: async () =>
      queryClient.invalidateQueries({
        queryKey: ["mock-exams", "advisor", "student", Number(studentId)],
      }),
  });
  return (
    <div className={assignStyles.workspace}>
      <section className={assignStyles.hero}>
        <div>
          <h1>{translate("exams:staff.assignTitle")}</h1>
          <p>
            {translate("exams:staff.assignHelp")}</p>
        </div>
      </section>
      <div className={assignStyles.columns}>
        <WorkspaceSection title={translate("exams:staff.prepare")} className={assignStyles.panel} bodyClassName={assignStyles.panelBody}>
          <form
            noValidate
            className={assignStyles.form}
            onSubmit={(event) => {
              event.preventDefault();
              if (assign.isPending || !studentId || !templateId || (sections.writing && !instructorId) || !Object.values(sections).some(Boolean)) return;
              assign.mutate();
            }}
          >
            <label className={styles.full}>
              <span>{translate("courseTools:groups.selectStudent")}</span>
              <span className={assignStyles.selectControl}>
              <UserRound size={20} aria-hidden="true"/>
              <select
                required
                value={studentId}
                onChange={(event) => {setStudentId(event.target.value); setAssignmentCount(undefined);}}
              >
                <option value="">{translate("exams:staff.studentPlaceholder")}</option>
                {studentRows.map((student) => {
                  const id = student.studentUserId;
                  return id ? (
                    <option value={id} key={id}>
                      {formatPersonName(student, translate('common:people.studentFallback', {id: formatNumber(id)}))} ·{" "}
                      {student.email || translate('common:records.id', {id: formatNumber(id)})}
                    </option>
                  ) : null;
                })}
              </select>
              <ChevronDown size={18} aria-hidden="true"/>
              </span>
            </label>
            {students.isSuccess && studentRows.length === 0 ? <p className={styles.full} role="status">{translate("exams:staff.noAssignedStudents")}</p> : null}
            <label className={styles.full}>
              <span>{translate("exams:staff.publishedTemplate")}</span>
              <span className={assignStyles.selectControl}>
              <FileText size={20} aria-hidden="true"/>
              <select
                required
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                <option value="">{translate("exams:staff.templatePlaceholder")}</option>
                {templates.map((template) => (
                  <option value={template.id} key={template.id}>
                    {template.title ||
                      template.label ||
                      translate('exams:staff.template', {id: template.id == null ? '—' : formatNumber(template.id)})}{" "}
                    · {template.publishedVersionNo == null ? translate('common:status.PUBLISHED') : translate('courseTools:delivery.version', {number: formatNumber(template.publishedVersionNo)})}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} aria-hidden="true"/>
              </span>
            </label>
            {templates.length === 0 ? <p className={styles.full} role="status">{translate("exams:staff.noPublishedPapers")}</p> : null}
            {templateId ? (
              <div className={styles.full} aria-label={translate("exams:staff.paperDetails")}>
                {selectedTemplate.isPending ? (
                  <p role="status">{translate("exams:staff.loadingPaper")}</p>
                ) : selectedTemplate.isError ? (
                  <ErrorNotice
                    error={selectedTemplate.error}
                    fallback={translate('exams:staff.paperFailed')}
                  />
                ) : (
                  <RecordSummaryList value={selectedTemplate.data} />
                )}
              </div>
            ) : null}
            <fieldset className={styles.full}>
              <legend>{translate("exams:staff.assignedSections")}</legend>
              <div className={assignStyles.sections}>
                {EXAM_SECTIONS.map((section) => (
                  <label key={section}>
                    <input
                      type="checkbox"
                      checked={sections[section]}
                      onChange={(event) =>
                        setSections((current) => ({
                          ...current,
                          [section]: event.target.checked,
                        }))
                      }
                    />
                    <Check size={18} aria-hidden="true"/>
                    <span>{translate(`common:admin.examSections.${section}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={styles.full}>
              {sections.writing ? (
                <AdvisorInstructorPicker
                  required
                  label={translate("exams:assignment.instructor")}
                  value={instructorId}
                  onChange={setInstructorId}
                />
              ) : null}
            </div>
            <div className={styles.formActions}>
              <button
                className={assignStyles.assignButton}
                disabled={
                  assign.isPending || !studentId || !templateId ||
                  (sections.writing && !instructorId) ||
                  !Object.values(sections).some(Boolean)
                }
              >
                {assign.isPending ? translate("exams:assignment.assigning") : translate("exams:assignment.assign")}
              </button>
            </div>
          </form>
          <ErrorNotice
            error={students.error || assign.error}
            fallback={translate('exams:staff.assignFailed')}
          />
        </WorkspaceSection>
        <WorkspaceSection title={translate("exams:staff.assignedPapers")} className={assignStyles.panel} bodyClassName={assignStyles.panelBody}
          meta={studentId && assignmentCount != null ? <span className={assignStyles.count}>{translate('exams:staff.assignedCount', {count: assignmentCount, number: formatNumber(assignmentCount)})}</span> : undefined}>
          {!studentId ? (
            <div className={assignStyles.empty}>
              <span className={assignStyles.emptyIcon}><Inbox size={28} aria-hidden="true"/></span>
              <h3>{translate("courseTools:groups.selectStudent")}</h3>
              <p>{translate("exams:staff.chooseStudentHelp")}</p>
            </div>
          ) : (
            <ObserverMockExams
              key={studentId}
              onCountChange={setAssignmentCount}
              emptyState={<div className={assignStyles.empty}>
                <span className={assignStyles.emptyIcon}><Inbox size={28} aria-hidden="true"/></span>
                <h3>{translate("exams:library.empty")}</h3>
                <p>{translate("exams:staff.firstExamHelp")}</p>
              </div>}
              scope="advisor"
              studentUserId={Number(studentId)}
            />
          )}
        </WorkspaceSection>
      </div>
    </div>
  );
}

export function InstructorWorkspace({ value }: { value: unknown }) {
  const {t: translate} = useTranslation();
  const rows = runtimeItems(value);
  const [gradeId, setGradeId] = useState<number | null>(() =>
    rows[0] ? idFrom(rows[0], "id", "gradeId", "writingGradeId") : null,
  );
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className={`${styles.workspace} ${styles.instructorWorkspace}`}>
      <section className={styles.hero}>
        <div>
          <div className={styles.queueEyebrow}><span>{translate("exams:staff.queue")}</span><span>{translate('exams:staff.queueCount', {count: rows.length, number: formatNumber(rows.length)})}</span></div>
          <h1>{translate("exams:staff.reviewTitle")}</h1>
          <p>
            {translate("exams:staff.reviewHelp")}</p>
        </div>
      </section>
      <div className={`${styles.queueLayout} ${rows.length ? styles.hasSubmissions : ''}`}>
        <WorkspaceSection title={translate("exams:staff.submissions")} className={styles.reviewPanel} bodyClassName={styles.reviewBody}>
          {rows.length ? (
            <div className={styles.cardList}>
              {rows.map((row, index) => {
                const id = idFrom(row, "id", "gradeId", "writingGradeId");
                return id ? (
                  <button
                    type="button"
                    className={
                      gradeId === id ? styles.selectedCard : styles.selectCard
                    }
                    onClick={() => {
                      setGradeId(id);
                    }}
                    key={id}
                    aria-pressed={gradeId === id}
                    disabled={submitting}
                  >
                    <span className={styles.cardTopline}>
                      {runtimeString(row, "status") ? statusLabel(runtimeString(row, "status")) : translate("exams:staff.awaitingReview")}
                      <small>#{formatNumber(id)}</small>
                    </span>
                    <strong>
                      {runtimeString(row, 'templateTitle') || recordLabel(row, translate('exams:staff.writingSubmission', {number: formatNumber(index + 1)}))}
                    </strong>
                    <span>
                      {formatDateValue(runtimeString(row, "submittedAt", "createdAt") ?? "") ||
                        translate("exams:staff.timeUnavailable")}
                    </span>
                  </button>
                ) : null;
              })}
            </div>
          ) : (
            <div className={styles.reviewEmpty}><span className={styles.caughtUpIcon}><CircleCheck size={27}/></span><h3>{translate("exams:staff.caughtUp")}</h3><p>{translate("exams:staff.noReviews")}</p></div>
          )}
        </WorkspaceSection>
        <WorkspaceSection
          title={gradeId ? translate('exams:staff.submissionId', {id: formatNumber(gradeId)}) : translate("exams:staff.selectSubmission")}
          className={styles.reviewPanel} bodyClassName={styles.reviewBody}
        >
          {gradeId ? (
            <WritingGradeReview key={gradeId} gradeId={gradeId} onBusy={setSubmitting}/>
          ) : (
            <div className={styles.reviewEmpty}><span className={styles.readyIcon}><TextCursor size={27}/></span><h3>{translate("exams:staff.ready")}</h3><p>{translate("exams:staff.selectReviewHelp")}</p></div>
          )}
        </WorkspaceSection>
      </div>
    </div>
  );
}
