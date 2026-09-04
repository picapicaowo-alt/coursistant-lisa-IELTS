import {useRef, useState} from 'react';
import {CalendarPlus, FileCheck2, X} from 'lucide-react';
import {useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {ObserverMockExams} from '@/components/ObserverMockExams';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';
import exStyles from './ExamsPage.module.scss';

const initialSections = () => ({
  listening: true,
  reading: true,
  writing: true,
});

export default function AdvisorStudentExamsPage() {
  const studentId = Number(useParams().studentUserId);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const dialog = useRef<HTMLDialogElement>(null);
  const [templateId, setTemplateId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [sections, setSections] = useState(initialSections);
  const templates = useQuery({
    queryKey: ['mock-exams', 'advisor', 'templates'],
    queryFn: async () =>
      unwrapData(
        await mockExamApiService.listAdvisorTemplates(),
        'advisorTemplates',
      ),
    retry: false,
  });
  const published = (templates.data ?? []).filter(
    (item) =>
      item.id != null &&
      (item.publishedVersionId != null || item.publishedVersionNo != null),
  );
  const assign = useMutation({
    meta: {advisingStudentId: studentId},
    mutationFn: () => {
      if (!Number.isInteger(studentId) || studentId <= 0 ||
          !published.some((item) => String(item.id) === templateId) ||
          !Object.values(sections).some(Boolean)) {
        throw new Error('Select a published paper and at least one section.');
      }
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
          mockExamApiService.createAdvisorStudentExam(studentId, payload, key),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['mock-exams', 'advisor', 'student', studentId],
      });
      setTemplateId('');
      setInstructorId('');
      setSections(initialSections());
      dialog.current?.close();
    },
  });

  return (
    <div className={exStyles.container}>
      <section className={exStyles.examCollection} aria-labelledby="assigned-exams-title">
        <header className={exStyles.examsHeader}>
          <div>
            <h2 id="assigned-exams-title">All Exams</h2>
            <p>Review assigned papers and released results for this student.</p>
          </div>
          <button
            type="button"
            className={exStyles.assignButton}
            onClick={() => {assign.reset(); dialog.current?.showModal();}}
          >
            <CalendarPlus size={17} aria-hidden="true" />
            Assign Exam
          </button>
        </header>
        <ObserverMockExams scope="advisor" studentUserId={studentId} />
      </section>

      <dialog
        ref={dialog}
        className={exStyles.assignmentDialog}
        aria-labelledby="assign-exam-title"
        onCancel={(event) => {
          if (assign.isPending) event.preventDefault();
        }}
      >
        <form
          className={exStyles.assignmentForm}
          onSubmit={(event) => {
            event.preventDefault();
            assign.mutate();
          }}
        >
          <div className={exStyles.dialogHeading}>
            <h2 id="assign-exam-title">Assign Exam</h2>
            <button
              type="button"
              aria-label="Close assign exam"
              disabled={assign.isPending}
              onClick={() => dialog.current?.close()}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className={exStyles.dialogBody}>
            <p className={exStyles.dialogIntro}>
              Choose a published paper, the included sections, and an optional
              writing instructor.
            </p>
            {templates.isPending ? <p role="status">Loading published papers…</p> : null}
            {templates.isError ? (
              <p role="alert">
                Papers could not be loaded.{' '}
                <button type="button" onClick={() => void templates.refetch()}>
                  Try again
                </button>
              </p>
            ) : null}
            {templates.isSuccess && published.length === 0 ? (
              <p>No published papers are available.</p>
            ) : null}

            <div className={exStyles.fieldGrid}>
              <label>
                Exam type
                <span className={exStyles.selectShell}>
                  <FileCheck2 size={16} aria-hidden="true" />
                  <select
                    value={templateId}
                    required
                    onChange={(event) => setTemplateId(event.target.value)}
                  >
                    <option value="">Select published paper</option>
                    {published.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title || item.label || `Paper #${item.id}`}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              {sections.writing ? (
                <AdvisorInstructorPicker
                  compact
                  label="Writing instructor"
                  value={instructorId}
                  onChange={setInstructorId}
                />
              ) : <div />}
            </div>

            <fieldset className={exStyles.sectionPicker}>
              <legend>Included sections</legend>
              <div>
                {(Object.keys(sections) as Array<keyof typeof sections>).map(
                  (section) => (
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
                      {section[0].toUpperCase() + section.slice(1)}
                    </label>
                  ),
                )}
              </div>
            </fieldset>

            <p className={exStyles.contractNote}>
              The selected sections will be added to this student’s assigned exams.
            </p>
            {assign.isError ? (
              <p className={styles.error} role="alert">
                {advisingErrorMessage(
                  assign.error,
                  'The exam could not be assigned.',
                )}
              </p>
            ) : null}
          </div>

          <footer className={exStyles.dialogFooter}>
            <button
              type="button"
              className={exStyles.cancelButton}
              disabled={assign.isPending}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={exStyles.createButton}
              disabled={
                assign.isPending ||
                !published.some((item) => String(item.id) === templateId) ||
                !Object.values(sections).some(Boolean)
              }
            >
              {assign.isPending ? 'Assigning…' : 'Assign exam'}
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
