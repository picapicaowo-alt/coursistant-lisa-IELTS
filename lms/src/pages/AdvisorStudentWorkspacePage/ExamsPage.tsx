import {useRef, useState} from 'react';
import {X} from 'lucide-react';
import {useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {ObserverMockExams} from '@/components/ObserverMockExams';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';
import exStyles from './ExamsPage.module.scss';

export default function AdvisorStudentExamsPage() {
  const studentId = Number(useParams().studentUserId);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const dialog = useRef<HTMLDialogElement>(null);
  const [templateId, setTemplateId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [sections, setSections] = useState({
    listening: true,
    reading: true,
    writing: true,
  });
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
      dialog.current?.close();
    },
  });
  return (
    <div className={exStyles.container}>
      <WorkspaceSection
        title="Assigned Exams"
        meta={
          <button
            type="button"
            className={styles.primary}
            onClick={() => dialog.current?.showModal()}
          >
            Assign exam
          </button>
        }
      >
        <ObserverMockExams scope="advisor" studentUserId={studentId} />
      </WorkspaceSection>
      <dialog
        ref={dialog}
        className={exStyles.assignmentDialog}
        aria-labelledby="assign-exam-title"
        onCancel={event => {if (assign.isPending) event.preventDefault();}}
      >
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            assign.mutate();
          }}
        >
          <div className={exStyles.dialogHeading}><h2 id="assign-exam-title">Assign a mock exam</h2><button type="button" aria-label="Close assign exam" disabled={assign.isPending} onClick={() => dialog.current?.close()}><X size={20}/></button></div>
          <p>Choose a published paper and its sections for this student.</p>
          {templates.isPending ? <p role="status">Loading papers…</p> : null}
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
          <label>
            Published paper
            <select
              value={templateId}
              required
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">Select paper</option>
              {published.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title || item.label || `Paper #${item.id}`}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Sections</legend>
            {(Object.keys(sections) as Array<keyof typeof sections>).map(
              (section) => (
                <label key={section} className={styles.inlineCheckbox}>
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
          </fieldset>
          {sections.writing ? (
            <AdvisorInstructorPicker
              label="Writing instructor"
              value={instructorId}
              onChange={setInstructorId}
            />
          ) : null}
          {assign.isError ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(
                assign.error,
                'The exam could not be assigned.',
              )}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={assign.isPending}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              className={styles.primary}
              disabled={
                assign.isPending ||
                !published.some((item) => String(item.id) === templateId) ||
                !Object.values(sections).some(Boolean)
              }
            >
              {assign.isPending ? 'Assigning…' : 'Assign exam'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
