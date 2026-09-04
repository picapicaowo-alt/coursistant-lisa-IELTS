import {WritingGradeReview} from "./WritingGradeReview";
import { WorkspaceSection } from "@/components/WorkspaceSection";
import { ObserverMockExams } from "@/components/ObserverMockExams";
import { AdvisorInstructorPicker } from "@/components/AdvisorInstructorPicker";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenText,
  CircleCheck,
  TextCursor,
  Headphones,
  Image as ImageIcon,
  PenLine,
  Check,
  ChevronDown,
  FileText,
  Inbox,
  UserRound,
} from "lucide-react";
import { unwrapData } from "@/apis";
import { advisorApiService } from "@/apis/services/advisor-api";
import { mockExamApiService } from "@/apis/services/mock-exam-api";
import { formatPersonName } from "@/utils/personName";
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

const SECTION_META = {
  listening: { label: "Listening", Icon: Headphones },
  reading: { label: "Reading", Icon: BookOpenText },
  writing: { label: "Writing", Icon: PenLine },
} satisfies Record<Section, { label: string; Icon: typeof Headphones }>;

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

type MediaState = { loading?: boolean; url?: string; error?: string };

type SectionMediaProps = {section: Section; value: unknown} & (
  {scope?: 'tenant'; templateId: number; versionId: number} | {scope: 'system'; testId: number}
);

export function ExamSectionMedia(props: SectionMediaProps) {
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
          error: advisingErrorMessage(
            error,
            "The protected media could not be loaded.",
          ),
        },
      }));
    }
  };

  // Only server-provided sequence identifiers address protected media.
  const items = section === 'listening'
    ? nestedRecords(value, 'parts').flatMap(part => {
      const seq = runtimeNumber(part, 'seq');
      return seq == null || part.hasAudio === false ? [] : [{key: `listening-${seq}`, label: runtimeString(part, 'label') || `Listening part ${seq}`, type: 'audio' as const, load: () => audio(seq)}];
    })
    : section === 'reading'
      ? nestedRecords(value, 'passages').flatMap(passage => {
        const passageSeq = runtimeNumber(passage, 'seq');
        if (passageSeq == null) return [];
        return nestedRecords(passage, 'questions').flatMap(question => {
          const sortOrder = runtimeNumber(question, 'sortOrder');
          return sortOrder == null || !(question.hasImage === true || runtimeString(question, 'imageSrc')) ? [] : [{key: `reading-${passageSeq}-${sortOrder}`, label: runtimeString(question, 'title') || `Passage ${passageSeq}, question group ${sortOrder}`, type: 'image' as const, load: () => readingImage(passageSeq, sortOrder)}];
        });
      })
      : nestedRecords(value, 'tasks').flatMap(task => {
        const seq = runtimeNumber(task, 'seq');
        return seq == null || !(task.hasImage === true || runtimeString(task, 'imageSrc')) ? [] : [{key: `writing-${seq}`, label: runtimeString(task, 'title') || `Writing task ${seq}`, type: 'image' as const, load: () => writingImage(seq)}];
      });

  if (!items.length) return null;

  return (
    <section
      className={styles.mediaReview}
      aria-label={`${SECTION_META[section].label} protected media`}
    >
      <div>
        <h4>Protected media</h4>
        <p>Preview the available media for this section.</p>
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
                    ? "Loading…"
                    : state?.url
                      ? "Reload media"
                      : item.type === "audio"
                        ? "Load audio"
                        : "Load image"}
                </button>
              </div>
              {state?.url && item.type === "audio" ? (
                <audio controls preload="none" src={state.url}>
                  Your browser does not support audio playback.
                </audio>
              ) : null}
              {state?.url && item.type === "image" ? (
                <img src={state.url} alt={`${item.label} reference`} />
              ) : null}
              {state?.error ? <p role="alert">{state.error}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function AdvisorWorkspace({ value }: { value: unknown }) {
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
          <h1>Match students to published papers</h1>
          <p>
            Assign mock exams to students, choose the exam sections, and review every prior assignment history.
          </p>
        </div>
      </section>
      <div className={assignStyles.columns}>
        <WorkspaceSection title="Prepare a mock exam" className={assignStyles.panel} bodyClassName={assignStyles.panelBody}>
          <form
            className={assignStyles.form}
            onSubmit={(event) => {
              event.preventDefault();
              assign.mutate();
            }}
          >
            <label className={styles.full}>
              <span>Select student</span>
              <span className={assignStyles.selectControl}>
              <UserRound size={20} aria-hidden="true"/>
              <select
                required
                value={studentId}
                onChange={(event) => {setStudentId(event.target.value); setAssignmentCount(undefined);}}
              >
                <option value="">Choose a student from your cohort</option>
                {studentRows.map((student) => {
                  const id = student.studentUserId;
                  return id ? (
                    <option value={id} key={id}>
                      {formatPersonName(student, `Student ${id}`)} ·{" "}
                      {student.email || `ID ${id}`}
                    </option>
                  ) : null;
                })}
              </select>
              <ChevronDown size={18} aria-hidden="true"/>
              </span>
            </label>
            {students.isSuccess && studentRows.length === 0 ? (
              <p className={styles.full} role="status">No students are assigned to you yet. Ask a counsellor to complete the advisor handover.</p>
            ) : null}
            <label className={styles.full}>
              <span>Published template</span>
              <span className={assignStyles.selectControl}>
              <FileText size={20} aria-hidden="true"/>
              <select
                required
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                <option value="">Select exam template</option>
                {templates.map((template) => (
                  <option value={template.id} key={template.id}>
                    {template.title ||
                      template.label ||
                      `Template ${template.id}`}{" "}
                    · v{template.publishedVersionNo ?? "published"}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} aria-hidden="true"/>
              </span>
            </label>
            {templates.length === 0 ? (
              <p className={styles.full} role="status">No published papers are available. A tenant administrator must publish a complete mock exam before you can assign it.</p>
            ) : null}
            {templateId ? (
              <div className={styles.full} aria-label="Selected paper details">
                {selectedTemplate.isPending ? (
                  <p role="status">Loading paper details…</p>
                ) : selectedTemplate.isError ? (
                  <ErrorNotice
                    error={selectedTemplate.error}
                    fallback="Paper details could not be loaded."
                  />
                ) : (
                  <RecordSummaryList value={selectedTemplate.data} />
                )}
              </div>
            ) : null}
            <fieldset className={styles.full}>
              <legend>Assigned sections</legend>
              <div className={assignStyles.sections}>
                {(Object.keys(SECTION_META) as Section[]).map((section) => (
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
                    <span>{SECTION_META[section].label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={styles.full}>
              {sections.writing ? (
                <AdvisorInstructorPicker
                  required
                  label="Writing instructor"
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
                {assign.isPending ? "Assigning…" : "Assign Exam"}
              </button>
            </div>
          </form>
          <ErrorNotice
            error={students.error || assign.error}
            fallback="The assignment could not be completed."
          />
        </WorkspaceSection>
        <WorkspaceSection title="Assigned papers" className={assignStyles.panel} bodyClassName={assignStyles.panelBody}
          meta={!studentId || assignmentCount != null ? <span className={assignStyles.count}>{studentId ? assignmentCount : 0} Assigned</span> : undefined}>
          {!studentId ? (
            <div className={assignStyles.empty}>
              <span className={assignStyles.emptyIcon}><Inbox size={28} aria-hidden="true"/></span>
              <h3>No Active Assignments</h3>
              <p>Select a student from the form on the left to review their complete assignment history and assign new mock exams.</p>
            </div>
          ) : (
            <ObserverMockExams
              key={studentId}
              onCountChange={setAssignmentCount}
              emptyState={<div className={assignStyles.empty}>
                <span className={assignStyles.emptyIcon}><Inbox size={28} aria-hidden="true"/></span>
                <h3>No assigned papers yet</h3>
                <p>Choose a published template and exam sections to assign this student their first mock exam.</p>
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
  const rows = runtimeItems(value);
  const [gradeId, setGradeId] = useState<number | null>(() =>
    rows[0] ? idFrom(rows[0], "id", "gradeId", "writingGradeId") : null,
  );
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className={`${styles.workspace} ${styles.instructorWorkspace}`}>
      <section className={styles.hero}>
        <div>
          <div className={styles.queueEyebrow}><span>Assigned review queue</span><span>{rows.length} queue items</span></div>
          <h1>Read the script. Return a clear result.</h1>
          <p>
            Work from the assigned queue, inspect the complete submission, then
            record a score and candidate-facing feedback.
          </p>
        </div>
      </section>
      <div className={`${styles.queueLayout} ${rows.length ? styles.hasSubmissions : ''}`}>
        <WorkspaceSection title="Writing submissions" className={styles.reviewPanel} bodyClassName={styles.reviewBody}>
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
                      {runtimeString(row, "status") || "Awaiting review"}
                      <small>#{id}</small>
                    </span>
                    <strong>
                      {runtimeString(row, "templateTitle") || recordLabel(row, `Writing submission ${index + 1}`)}
                    </strong>
                    <span>
                      {runtimeString(row, "submittedAt", "createdAt") ||
                        "Submission time unavailable"}
                    </span>
                  </button>
                ) : null;
              })}
            </div>
          ) : (
            <div className={styles.reviewEmpty}><span className={styles.caughtUpIcon}><CircleCheck size={27}/></span><h3>All caught up!</h3><p>No writing submissions are waiting for review in this pool.</p></div>
          )}
        </WorkspaceSection>
        <WorkspaceSection
          title={gradeId ? `Submission #${gradeId}` : "Select a submission"}
          className={styles.reviewPanel} bodyClassName={styles.reviewBody}
        >
          {gradeId ? (
            <WritingGradeReview key={gradeId} gradeId={gradeId} onBusy={setSubmitting}/>
          ) : (
            <div className={styles.reviewEmpty}><span className={styles.readyIcon}><TextCursor size={27}/></span><h3>Ready to review</h3><p>Choose a queue item to begin grading.</p></div>
          )}
        </WorkspaceSection>
      </div>
    </div>
  );
}

export function SystemWorkspace({value}: {value: unknown}) {
  const rows = runtimeItems(value);
  const [selectedId, setSelectedId] = useState<number>();
  const [section, setSection] = useState<Section>('listening');
  const detail = useQuery({queryKey: ['mock-exams', 'system-detail', selectedId], queryFn: async () => unwrapData(await mockExamApiService.getSystemExam(selectedId!), 'systemMockExam'), enabled: selectedId != null, retry: false});
  const content = useQuery({queryKey: ['mock-exams', 'system-section', selectedId, section], queryFn: async () => unwrapData(await mockExamApiService.getSystemSection(selectedId!, section), 'systemMockExamSection'), enabled: selectedId != null && detail.isSuccess, retry: false});
  return <div className={styles.workspace}>
    <section className={styles.hero}><div><h1>Mock exam operations</h1><p>Review exam records and their Listening, Reading and Writing content.</p></div></section>
    <div className={styles.twoColumn}>
      <WorkspaceSection title="Exam records"><div className={styles.recordList}>{rows.length ? rows.map(row => {
        const id = runtimeNumber(row, 'testId', 'id');
        return <button key={id ?? recordLabel(row, 'Exam')} type="button" className={styles.recordButton} disabled={id == null} aria-pressed={selectedId === id} onClick={() => {if (id != null) setSelectedId(id);}}><strong>{recordLabel(row, id == null ? 'Exam record' : `Exam #${id}`)}</strong><span>{runtimeString(row, 'status', 'state') || 'View record'}</span></button>;
      }) : <p>No exam records are available.</p>}</div></WorkspaceSection>
      <WorkspaceSection title="Exam content">{selectedId == null ? <p>Select an exam to review its content.</p> : <>
        {detail.isPending ? <p role="status">Loading exam…</p> : null}
        {detail.isError ? <p role="alert">Exam could not be loaded. <button type="button" onClick={() => void detail.refetch()}>Retry</button></p> : null}
        <div className={styles.sectionTabs} aria-label="Exam section">{(Object.keys(SECTION_META) as Section[]).map(key => <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)}>{SECTION_META[key].label}</button>)}</div>
        {content.isPending ? <p role="status">Loading section…</p> : null}
        {content.isError ? <p role="alert">This section could not be loaded. <button type="button" onClick={() => void content.refetch()}>Retry section</button></p> : null}
        {content.isSuccess ? <><RecordSummaryList value={content.data} emptyMessage="No content in this section."/><ExamSectionMedia key={`${selectedId}-${section}`} scope="system" testId={selectedId} section={section} value={content.data}/></> : null}
      </>}</WorkspaceSection>
    </div>
  </div>;
}
