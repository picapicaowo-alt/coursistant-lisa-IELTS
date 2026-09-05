import {useTranslation} from 'react-i18next';
import type {StudentMockExamDetail} from '@/apis';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {formatNumber} from '@/i18n/formatting';
import type {MockExamSection} from './submissionState';
import styles from './SubmittedExamSection.module.scss';

export function SubmittedExamSection({exam, section, onExit}: {
  exam: StudentMockExamDetail;
  section: MockExamSection;
  onExit: () => void;
}) {
  const {t} = useTranslation('course');
  const score = section === 'writing' ? exam.writingScore : section === 'reading' ? exam.readingCorrect : exam.listeningCorrect;
  const total = section === 'reading' ? exam.readingTotal : exam.listeningTotal;
  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p>{t('mockResults.submitted')}</p><h1>{exam.title || t('mockResults.title')}</h1></div>
      <button type="button" onClick={onExit}>{t('mockResults.back')}</button>
    </header>
    <WorkspaceSection title={t(`mockResults.sections.${section}`)} className={styles.content}>
      <p>{t('mockResults.saved')}</p>
      {section === 'writing' ? <>
        <h3>{t('mockResults.feedback')}</h3>
        <p className={styles.prose}>{exam.writingFeedback || t('mockResults.feedbackPending')}</p>
        {(exam.writingTasks ?? []).map((task, index) => <article key={task.taskKey ?? index} className={styles.response}>
          <h3>{t('mockResults.task', {number: formatNumber(task.seq ?? index + 1)})}</h3>
          {typeof task.wordCount === 'number' ? <p>{t('mockResults.words', {number: formatNumber(task.wordCount)})}</p> : null}
          <p className={styles.prose}>{task.content || t('mockResults.responseUnavailable')}</p>
        </article>)}
      </> : null}
    </WorkspaceSection>
    <WorkspaceSection title={t('mockResults.result')} className={styles.summary}>
      <p className={styles.score}>{typeof score === 'number'
        ? section === 'writing' || typeof total !== 'number' ? formatNumber(score) : t('mockResults.correct', {score: formatNumber(score), total: formatNumber(total)})
        : t('mockResults.pending')}</p>
    </WorkspaceSection>
  </main>;
}
