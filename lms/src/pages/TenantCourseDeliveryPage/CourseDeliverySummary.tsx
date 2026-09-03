import {ArrowRight, FileText} from 'lucide-react';
import type {CourseResponse, CourseSession} from '@/apis';
import {COURSE_SESSION_DAYS} from '@/configs/courseSessions';
import {courseTermLabel, formatCourseTime} from '../advising/courseManagement';
import styles from '../advising/CourseManagement.module.scss';

export function CourseDeliverySummary({course, sessions, sessionsPending, onViewSchedule}: {
  course?: CourseResponse;
  sessions?: CourseSession[];
  sessionsPending: boolean;
  onViewSchedule: () => void;
}) {
  const primary = sessions?.[0];
  const weekday = primary ? COURSE_SESSION_DAYS.find(day => day.value === primary.dayOfWeek)?.label ?? primary.dayOfWeek : '';

  return <>
    <section className={styles.panel} aria-labelledby="delivery-schedule-summary-title">
      <header className={styles.panelHeader}><h2 id="delivery-schedule-summary-title">Schedule summary</h2></header>
      {sessionsPending ? <p role="status" className={styles.helper}>Loading schedule…</p> : primary ? <div className={styles.scheduleSummaryRow}>
        <span className={styles.sessionType} data-type={primary.type}>{primary.type}</span>
        <span className={styles.scheduleSummaryCopy}><strong>Every {weekday} · {formatCourseTime(primary.startTime)} — {formatCourseTime(primary.endTime)}</strong><small>{primary.location || 'Location not provided'} · {primary.timezone || 'Timezone not provided'}</small></span>
        <span className={styles.scheduleSummaryCount}><strong>{sessions?.length ?? 0} recurring {sessions?.length === 1 ? 'slot' : 'slots'}</strong><small>{course ? courseTermLabel(course) : 'Term loading…'}</small></span>
      </div> : <p className={styles.helper}>{sessions ? 'No recurring sessions have been added.' : 'Schedule unavailable. Retry the schedule read to continue.'}</p>}
      <button type="button" className={styles.textAction} onClick={onViewSchedule}>View full schedule <ArrowRight size={15} aria-hidden="true" /></button>
    </section>
    <section className={styles.panel} aria-labelledby="teaching-workspace-title">
      <header className={styles.panelHeader}><h2 id="teaching-workspace-title">Teaching workspace</h2><span className={styles.mutedMeta}>Instructor managed</span></header>
      <div className={styles.handoffRow}><span className={styles.fileIcon}><FileText size={19} aria-hidden="true" /></span><span><strong>Materials and assessments</strong><small>{course?.primaryInstructor?.name || course?.primaryInstructor?.email || 'The assigned instructor'} manages teaching content in the existing course workspace.</small></span></div>
    </section>
  </>;
}
