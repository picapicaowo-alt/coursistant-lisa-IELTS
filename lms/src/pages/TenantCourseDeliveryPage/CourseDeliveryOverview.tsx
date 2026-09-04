import type {CourseDeliveryConfigResponse, CourseResponse, CourseSession} from '@/apis';
import {courseDeliveryLabel, courseTermLabel} from '../advising/courseManagement';
import styles from '../advising/CourseManagement.module.scss';

export function CourseDeliveryOverview({course, config, sessions, sessionsPending, onView}: {
  course?: CourseResponse;
  config?: CourseDeliveryConfigResponse | null;
  sessions?: CourseSession[];
  sessionsPending: boolean;
  onView: (view: 'delivery' | 'schedule') => void;
}) {
  return <>
    <section className={styles.panel} aria-labelledby="delivery-overview-title">
      <header className={styles.panelHeader}><div><h2 id="delivery-overview-title">Course overview</h2><p>Identity, ownership, and delivery configuration.</p></div><button type="button" className={styles.ghostButton} onClick={() => onView('delivery')}>View delivery</button></header>
      <dl className={styles.detailFacts}>
        <div><dt>Course code</dt><dd>{course?.courseCode || 'Not available'}</dd></div>
        <div><dt>Catalog code</dt><dd>{config?.catalogCode || 'Not configured'}</dd></div>
        <div><dt>Delivery type</dt><dd>{courseDeliveryLabel(config?.deliveryMode)}</dd></div>
        <div><dt>Capacity</dt><dd>{config?.capacity == null ? 'Not configured' : `${config.capacity} students`}</dd></div>
        <div><dt>Term</dt><dd>{course ? courseTermLabel(course) : 'Loading…'}</dd></div>
        <div><dt>Primary instructor</dt><dd>{course?.primaryInstructor?.name || course?.primaryInstructor?.email || 'Not assigned'}</dd></div>
      </dl>
    </section>
    <section className={styles.panel} aria-labelledby="schedule-summary-title">
      <header className={styles.panelHeader}><div><h2 id="schedule-summary-title">Schedule summary</h2><p>Recurring weekly teaching slots.</p></div><button type="button" className={styles.ghostButton} onClick={() => onView('schedule')}>View schedule</button></header>
      {sessionsPending ? <p role="status" className={styles.helper}>Loading schedule…</p> : null}
      {sessions?.length ? <dl className={styles.detailFacts}>
        <div><dt>Recurring sessions</dt><dd>{sessions.length}</dd></div>
        <div><dt>Next pattern</dt><dd>{sessions[0].type} · {sessions[0].dayOfWeek} · {sessions[0].startTime.slice(0, 5)}–{sessions[0].endTime.slice(0, 5)}</dd></div>
        <div><dt>Location</dt><dd>{sessions[0].location || 'Not provided'}</dd></div>
        <div><dt>Timezone</dt><dd>{sessions[0].timezone || 'Not provided'}</dd></div>
      </dl> : !sessionsPending ? <p className={styles.helper}>{sessions ? 'No recurring sessions have been added.' : 'The weekly schedule could not be loaded.'}</p> : null}
    </section>
  </>;
}
