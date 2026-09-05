import {formatInstructorName} from '@/utils/personName';
import { useTranslation } from 'react-i18next';
import {FileText} from 'lucide-react';
import type {CourseResponse, CourseSession} from '@/apis';
import {formatNumber, formatWeekday} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import {courseTermLabel, formatCourseTime} from '../advising/courseManagement';
import styles from '../advising/CourseManagement.module.scss';

export function CourseDeliverySummary({course, sessions, sessionsPending, onViewSchedule}: {
  course?: CourseResponse;
  sessions?: CourseSession[];
  sessionsPending: boolean;
  onViewSchedule: () => void;
}) {
  const { t: translate } = useTranslation();
  const primary = sessions?.[0];
  const weekday = primary ? formatWeekday(primary.dayOfWeek, 'long') : '';

  return <>
    <section className={styles.panel} aria-labelledby="delivery-schedule-summary-title">
      <header className={styles.panelHeader}><h2 id="delivery-schedule-summary-title">{translate("courseTools:delivery.scheduleSummary")}</h2></header>
      {sessionsPending ? <p role="status" className={styles.helper}>{translate("dashboard:loadingSchedule")}</p> : primary ? <div className={styles.scheduleSummaryRow}>
        <span className={styles.sessionType} data-type={primary.type}>{statusLabel(primary.type)}</span>
        <span className={styles.scheduleSummaryCopy}><strong>{translate("courseTools:schedule.everyWeekday", {day: weekday})} · {formatCourseTime(primary.startTime)} — {formatCourseTime(primary.endTime)}</strong><small>{primary.location || translate("course:catalogue.noLocation")} · {primary.timezone || translate("courseTools:delivery.timezoneMissing")}</small></span>
        <span className={styles.scheduleSummaryCount}><strong>{translate('courseTools:delivery.slots', {count: sessions?.length ?? 0, number: formatNumber(sessions?.length ?? 0)})}</strong><small>{course ? courseTermLabel(course) : translate("courseTools:delivery.termLoading")}</small></span>
      </div> : <p className={styles.helper}>{sessions ? translate("courseTools:delivery.noSessions") : translate("courseTools:delivery.scheduleFailed")}</p>}
      <button type="button" className={styles.textAction} onClick={onViewSchedule}>{translate('common:navigationControls.viewFullSchedule')} </button>
    </section>
    <section className={styles.panel} aria-labelledby="teaching-workspace-title">
      <header className={styles.panelHeader}><h2 id="teaching-workspace-title">{translate("courseTools:delivery.workspace")}</h2><span className={styles.mutedMeta}>{translate("courseTools:delivery.instructorManaged")}</span></header>
      <div className={styles.handoffRow}><span className={styles.fileIcon}><FileText size={19} aria-hidden="true" /></span><span><strong>{translate("courseTools:delivery.materialsAssessments")}</strong><small>{translate('courseTools:delivery.contentOwner', {instructor: formatInstructorName(course?.primaryInstructor, course?.primaryInstructor?.email || translate('courseTools:delivery.assignedInstructor'))})}</small></span></div>
    </section>
  </>;
}
