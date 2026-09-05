import {formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import {LocalizedError} from '@/i18n/errors';
import {useTranslation} from 'react-i18next';
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
  const {t: translate} = useTranslation();
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
        throw new LocalizedError('exams:assignment.selectRequired');
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
            <h2 id="assigned-exams-title">{translate("exams:assignment.all")}</h2>
            <p>{translate("exams:assignment.description")}</p>
          </div>
          <button
            type="button"
            className={exStyles.assignButton}
            onClick={() => {assign.reset(); dialog.current?.showModal();}}
          >
            <CalendarPlus size={17} aria-hidden="true" />
            {translate("exams:assignment.assign")}</button>
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
        <form noValidate
          className={exStyles.assignmentForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (!assign.isPending) assign.mutate();
          }}
        >
          <div className={exStyles.dialogHeading}>
            <h2 id="assign-exam-title">{translate("exams:assignment.assign")}</h2>
            <button
              type="button"
              aria-label={translate("exams:assignment.close")}
              disabled={assign.isPending}
              onClick={() => dialog.current?.close()}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className={exStyles.dialogBody}>
            <p className={exStyles.dialogIntro}>
              {translate("exams:assignment.help")}</p>
            {templates.isPending ? <p role="status">{translate("exams:assignment.loading")}</p> : null}
            {templates.isError ? (
              <p role="alert">
                {translate("exams:assignment.loadFailed")}{' '}
                <button type="button" onClick={() => void templates.refetch()}>
                  {translate("common:actions.tryAgain")}</button>
              </p>
            ) : null}
            {templates.isSuccess && published.length === 0 ? (
              <p>{translate("exams:assignment.noPapers")}</p>
            ) : null}

            <div className={exStyles.fieldGrid}>
              <label>
                {translate("exams:assignment.type")}<span className={exStyles.selectShell}>
                  <FileCheck2 size={16} aria-hidden="true" />
                  <select
                    value={templateId}
                    required
                    onChange={(event) => setTemplateId(event.target.value)}
                  >
                    <option value="">{translate("exams:assignment.selectPaper")}</option>
                    {published.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title || item.label || translate('exams:assignment.paper', {id: item.id == null ? '—' : formatNumber(item.id)})}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              {sections.writing ? (
                <AdvisorInstructorPicker
                  label={translate("exams:assignment.instructor")}
                  value={instructorId}
                  onChange={setInstructorId}
                />
              ) : <div />}
            </div>

            <fieldset className={exStyles.sectionPicker}>
              <legend>{translate("exams:assignment.sections")}</legend>
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
                      {statusLabel(section)}
                    </label>
                  ),
                )}
              </div>
            </fieldset>

            <p className={exStyles.contractNote}>
              {translate('exams:assignment.selectedSectionsHelp')}
            </p>
            {assign.isError ? (
              <p className={styles.error} role="alert">
                {advisingErrorMessage(
                  assign.error,
                  translate('exams:assignment.failed'),
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
              {translate("common:actions.cancel")}</button>
            <button
              type="submit"
              className={exStyles.createButton}
              disabled={
                assign.isPending ||
                !published.some((item) => String(item.id) === templateId) ||
                !Object.values(sections).some(Boolean)
              }
            >
              {assign.isPending ? translate("exams:assignment.assigning") : translate("exams:assignment.assignButton")}
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
