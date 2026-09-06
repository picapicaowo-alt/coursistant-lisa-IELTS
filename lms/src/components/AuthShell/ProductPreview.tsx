import {useTranslation} from 'react-i18next';
import {ArrowRight, CalendarDays, ChevronRight, FileText, Menu, Plus} from 'lucide-react';
import {formatDateTime, formatNumber, formatPercent} from '@/i18n/formatting';
import styles from './ProductPreview.module.scss';

// Decorative Figma sample data, not an authenticated student's records. Dates use
// UTC explicitly so the promotional example never shifts a day across time zones.
const exampleDate = new Date('2026-04-25T09:00:00Z');
const completionDate = new Date('2026-12-01T00:00:00Z');
const courseRows = [
  {titleKey: 'preview.writing', kind: 'preClass', status: 'OVERDUE'},
  {titleKey: 'preview.reading', kind: 'homework', status: 'NOT_SUBMITTED'},
  {titleKey: 'preview.listening', kind: 'practice', status: 'SUBMITTED'},
  {titleKey: 'preview.listening', kind: 'practice', status: 'GRADED'},
] as const;
const examRows = [
  {status: 'inProgress', action: 'continueExam'},
  {status: 'NOT_STARTED', action: 'scheduledExam'},
  {status: 'GRADED', action: 'viewFeedback'},
] as const;

/** Text stays in the shared resources, instead of being baked into screenshots. */
export function ProductPreview() {
  const {t} = useTranslation('auth');
  const day = formatDateTime(exampleDate, {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
  const time = formatDateTime(exampleDate, {hour: 'numeric', minute: '2-digit', timeZone: 'UTC'});
  return <div className={styles.preview}>
    <div className={styles.dashboard} data-auth-preview="dashboard">
      <div className={styles.assistant}>
        <header><Menu/><strong>{t('preview.newChat')}</strong><Plus/></header>
        <p className={styles.greeting}>{t('preview.greeting')}<br/>{t('preview.help')}</p>
        <div className={styles.prompts}>{(['explain', 'review', 'speaking', 'advice'] as const).map(key => <span key={key}>{t(`preview.${key}`)}</span>)}</div>
        <div className={styles.composer}><Plus/><span>{t('preview.ask')}</span><ArrowRight/></div>
      </div>
      <div className={styles.workspace}>
        <section className={styles.card}>
          <header><strong>{t('preview.allCourses')}</strong><span>{t('preview.viewAll')} <ChevronRight/></span></header>
          <div className={styles.courseRows}>{courseRows.map((row, index) => <div className={styles.courseRow} key={`${row.titleKey}-${index}`}>
            <FileText className={styles.fileIcon} data-kind={row.kind}/>
            <div><strong>{t(row.titleKey)}</strong><small>{t(`preview.${row.kind}`)}</small></div>
            <div><span>{index === 3 ? t('preview.score', {score: `${formatNumber(40)} / ${formatNumber(50)}`}) : t('preview.due', {date: day})}</span><small className={styles.status} data-status={row.status}>{t(`common:status.${row.status}`)}</small></div>
            <span className={styles.outline}>{index > 1 ? t('preview.resubmit') : t('common:status.SUBMITTED')}</span>
          </div>)}</div>
        </section>
        <section className={styles.card}>
          <header><strong>{t('preview.advisorTasks')}</strong><span>{t('preview.viewAll')} <ChevronRight/></span></header>
          <div className={styles.taskRows}>{[0, 1, 2].map(index => <div className={styles.taskRow} key={index}>
            <div><strong>{t(index === 1 ? 'preview.reviewFeedback' : 'preview.bookSpeaking')}</strong><small>{t(index === 1 ? 'preview.teacherFeedback' : 'preview.speakingFeedback')}</small></div>
            <span>{index === 0 ? day : index === 1 ? formatPercent(0.5) : '—'}</span>
            <span className={styles.outline}>{index === 0 ? t('common:status.SUBMITTED') : t('common:actions.viewDetails')}</span>
          </div>)}</div>
        </section>
        <section className={styles.card}>
          <header><strong>{t('preview.exams')}</strong><span>{t('preview.viewAll')} <ChevronRight/></span></header>
          <div className={styles.exams}>{examRows.map((exam, index) => <div className={styles.exam} key={exam.status}>
            <strong>{t('preview.mockTest')}</strong>
            <span className={styles.status} data-status={exam.status}>{t(`common:status.${exam.status}`)}</span>
            <p><small>{t(index === 2 ? 'preview.submittedAt' : 'preview.startTime')}</small>{time}{index === 0 ? <><small>{t('preview.remaining')}</small>{t('preview.remainingValue')}</> : <span>{day}</span>}</p>
            <span className={styles.outline}>{t(`preview.${exam.action}`)}</span>
          </div>)}</div>
        </section>
      </div>
    </div>
    <div className={styles.goal} data-auth-preview="goal">
      <h3>{t('preview.goal')}</h3><p>{t('preview.encouragement')}</p>
      <div className={styles.goalBody}>
        <div className={styles.scores}><div><span>{t('preview.currentScore')}</span><strong>{formatNumber(6, {minimumFractionDigits: 1})}</strong></div><ArrowRight/><div><span>{t('preview.targetScore')}</span><strong>{formatNumber(7.5)}</strong></div></div>
        <div className={styles.ring}><strong>{formatPercent(0.5)}</strong><span>{t('preview.progress')}</span></div>
        <div className={styles.completion}><CalendarDays/><div><span>{t('preview.completion')}</span><strong>{formatDateTime(completionDate, {month: 'long', year: 'numeric', timeZone: 'UTC'})}</strong></div></div>
      </div>
    </div>
  </div>;
}
