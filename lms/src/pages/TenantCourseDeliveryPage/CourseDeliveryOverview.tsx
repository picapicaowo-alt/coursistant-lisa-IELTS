import {formatInstructorName} from '@/utils/personName';
import { useTranslation } from 'react-i18next';
import type {CourseDeliveryConfigResponse, CourseResponse, CourseSession} from '@/apis';
import {formatClockTime, formatNumber, formatWeekday} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import {courseDeliveryLabel, courseTermLabel} from '../advising/courseManagement';
import styles from '../advising/CourseManagement.module.scss';

export function CourseDeliveryOverview({course, config, sessions, sessionsPending, onView}: {
  course?: CourseResponse;
  config?: CourseDeliveryConfigResponse | null;
  sessions?: CourseSession[];
  sessionsPending: boolean;
  onView: (view: 'delivery' | 'schedule') => void;
}) {
  const { t: translate } = useTranslation();
  return <>
    <section className={styles.panel} aria-labelledby="delivery-overview-title">
      <header className={styles.panelHeader}><div><h2 id="delivery-overview-title">{translate("course:learning.overview")}</h2><p>{translate("courseTools:delivery.overviewHelp")}</p></div><button type="button" className={styles.ghostButton} onClick={() => onView('delivery')}>{translate("courseTools:delivery.view")}</button></header>
      <dl className={styles.detailFacts}>
        <div><dt>{translate("course:form.codeLabel")}</dt><dd>{course?.courseCode || translate("common:feedback.notAvailable")}</dd></div>
        <div><dt>{translate("courseTools:delivery.catalogCode")}</dt><dd>{config?.catalogCode || translate("courseTools:delivery.notConfigured")}</dd></div>
        <div><dt>{translate("courseTools:delivery.type")}</dt><dd>{courseDeliveryLabel(config?.deliveryMode)}</dd></div>
        <div><dt>{translate("courseTools:delivery.capacity")}</dt><dd>{config?.capacity == null ? translate("courseTools:delivery.notConfigured") : translate('courseTools:delivery.students', {count: config.capacity, number: formatNumber(config.capacity)})}</dd></div>
        <div><dt>{translate("course:learning.term")}</dt><dd>{course ? courseTermLabel(course) : translate("common:feedback.loading")}</dd></div>
        <div><dt>{translate("common:admin.operations.reassign")}</dt><dd>{formatInstructorName(course?.primaryInstructor, course?.primaryInstructor?.email || translate("course:learning.notAssigned"))}</dd></div>
      </dl>
    </section>
    <section className={styles.panel} aria-labelledby="schedule-summary-title">
      <header className={styles.panelHeader}><div><h2 id="schedule-summary-title">{translate("courseTools:delivery.scheduleSummary")}</h2><p>{translate("courseTools:delivery.recurringHelp")}</p></div><button type="button" className={styles.ghostButton} onClick={() => onView('schedule')}>{translate("courseTools:delivery.viewSchedule")}</button></header>
      {sessionsPending ? <p role="status" className={styles.helper}>{translate("dashboard:loadingSchedule")}</p> : null}
      {sessions?.length ? <dl className={styles.detailFacts}>
        <div><dt>{translate("courseTools:delivery.recurring")}</dt><dd>{formatNumber(sessions.length)}</dd></div>
        <div><dt>{translate("courseTools:delivery.nextPattern")}</dt><dd>{statusLabel(sessions[0].type)} · {formatWeekday(sessions[0].dayOfWeek)} · {formatClockTime(sessions[0].startTime)}–{formatClockTime(sessions[0].endTime)}</dd></div>
        <div><dt>{translate("calendar:details.location")}</dt><dd>{sessions[0].location || translate("common:feedback.notProvided")}</dd></div>
        <div><dt>{translate("calendar:editor.timezone")}</dt><dd>{sessions[0].timezone || translate("common:feedback.notProvided")}</dd></div>
      </dl> : !sessionsPending ? <p className={styles.helper}>{sessions ? translate("courseTools:delivery.noSessions") : translate("courseTools:delivery.scheduleFailed")}</p> : null}
    </section>
  </>;
}
