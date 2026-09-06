import {useTranslation} from 'react-i18next';
import {statusLabel} from '@/i18n/presentation';
import {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import type {AdvisorStudentCourseResponse} from '@/apis';
import {RecordSummaryList} from '@/components/RecordSummaryList';
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
  const {t: translate} = useTranslation();
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
          {course.title || course.courseCode || translate("learning:parent.courseDetails")}
        </h2>
        <button
          type="button"
          aria-label={translate("advising:courseSummary.close")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <nav aria-label={translate("advising:courseSummary.views")}>
        <button
          type="button"
          aria-pressed={view === 'overview'}
          onClick={() => setView('overview')}
        >
          {translate("advising:courseSummary.information")}</button>
        <button
          type="button"
          aria-pressed={view === 'schedule'}
          onClick={() => setView('schedule')}
        >
          {translate("advising:courseSummary.schedule")}</button>
      </nav>
      {view === 'overview' ? (
        <dl className={styles.courseFacts}>
          <div>
            <dt>{translate("course:form.codeLabel")}</dt>
            <dd>{course.courseCode || translate("common:feedback.notAvailable")}</dd>
          </div>
          <div>
            <dt>{translate("advising:courseSummary.delivery")}</dt>
            <dd>{course.deliveryMode === 'GROUP' ? translate('courseTools:delivery.group') : statusLabel(course.deliveryMode)}</dd>
          </div>
          <div>
            <dt>{translate("common:people.instructor")}</dt>
            <dd>{instructors.join(', ') || primary || translate("course:learning.notAssigned")}</dd>
          </div>
          <div>
            <dt>{translate("common:fields.status")}</dt>
            <dd>
              {course.lifecycleStatus ||
                course.launchState ||
                course.status ||
                translate("common:feedback.notProvided")}
            </dd>
          </div>
          <div>
            <dt>{translate("advising:courseSummary.completedLectures")}</dt>
            <dd>
              {course.lectureCompleted ?? translate("common:feedback.notAvailable")} /{' '}
              {course.lectureTotal ?? translate("common:feedback.notAvailable")}
            </dd>
          </div>
          <div>
            <dt>{translate("advising:courseSummary.alignment")}</dt>
            <dd>{course.alignmentNotes || translate("advising:courseSummary.noAlignment")}</dd>
          </div>
        </dl>
      ) : (
        <RecordSummaryList
          value={course.schedule}
          emptyMessage={translate("advising:courseSummary.noSchedule")}
        />
      )}
      <footer>
        <button type="button" onClick={onClose}>
          {translate("common:actions.close")}</button>
      </footer>
    </dialog>
  );
}
