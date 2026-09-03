import {useEffect, useRef, useState} from 'react';
import {CalendarClock, X} from 'lucide-react';
import type {AdvisorStudentCourseResponse} from '@/apis';
import {contractClock} from '@/utils/contractTime';
import {formatPersonName} from '@/utils/personName';
import styles from './CoursesPage.module.scss';

/** Only student-scoped course data is shown. Delivery administration has a
 * different owner boundary and is not a course-detail read permission. */
export function CourseSummaryDialog({
  course,
  onClose,
}: {
  course: AdvisorStudentCourseResponse;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<'overview' | 'schedule'>('overview');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const instructors =
    course.instructors
      ?.map((person) => formatPersonName(person))
      .filter(Boolean) ?? [];
  const primary = formatPersonName({
    firstName: course.instructorFirstName,
    middleName: course.instructorMiddleName,
    lastName: course.instructorLastName,
  });
  return (
    <dialog
      ref={dialog}
      className={styles.courseDialog}
      aria-labelledby="view-course-title"
      onClose={onClose}
    >
      <header>
        <h2 id="view-course-title">
          {course.title || course.courseCode || 'Course details'}
        </h2>
        <button
          type="button"
          aria-label="Close course details"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <nav aria-label="Course details views">
        <button
          type="button"
          aria-pressed={view === 'overview'}
          onClick={() => setView('overview')}
        >
          Course Information
        </button>
        <button
          type="button"
          aria-pressed={view === 'schedule'}
          onClick={() => setView('schedule')}
        >
          Class Schedule
        </button>
      </nav>
      {view === 'overview' ? (
        <dl className={styles.courseFacts}>
          <div>
            <dt>Course code</dt>
            <dd>{course.courseCode || 'Not available'}</dd>
          </div>
          <div>
            <dt>Delivery mode</dt>
            <dd>{course.deliveryMode?.replace(/_/g, ' ') || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Instructor</dt>
            <dd>{instructors.join(', ') || primary || 'Not assigned'}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {course.lifecycleStatus ||
                course.launchState ||
                course.status ||
                'Not provided'}
            </dd>
          </div>
          <div>
            <dt>Lectures completed</dt>
            <dd>
              {course.lectureCompleted ?? 'Not available'} /{' '}
              {course.lectureTotal ?? 'Not available'}
            </dd>
          </div>
          <div>
            <dt>Study plan alignment</dt>
            <dd>{course.alignmentNotes || 'No alignment notes yet.'}</dd>
          </div>
        </dl>
      ) : (
        course.schedule?.length ? <div className={styles.scheduleList}>{course.schedule.map((session, index) => <article className={styles.scheduleRow} key={session.sessionId ?? index}>
          <CalendarClock size={20} aria-hidden="true"/>
          <div><strong>{session.dayOfWeek ? session.dayOfWeek.charAt(0) + session.dayOfWeek.slice(1).toLowerCase() : 'Weekly class'}</strong>
            <p>{[contractClock(session.startTime), contractClock(session.endTime)].filter(Boolean).join('–') || 'Time not provided'}</p>
            {session.location ? <small>{session.location}</small> : null}
          </div>
          {session.type ? <span>{session.type.replace(/_/g, ' ')}</span> : null}
        </article>)}</div> : <p>No class schedule is available yet.</p>
      )}
      <footer>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </footer>
    </dialog>
  );
}
