import { useTranslation } from 'react-i18next';
import {formatNumber, formatNumericText} from '@/i18n/formatting';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {generatePath, Link} from 'react-router-dom';
import {ClipboardCheck} from 'lucide-react';
import {unwrapData} from '@/apis';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {useMyCourses} from '@/hooks/useCourseAccess';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {formatPlanDate} from '@/utils/studyPlan';
import styles from './LearningProfile.module.scss';

export function ReleasedAssessments() {
  const { t: translate } = useTranslation();
  const courses = useMyCourses();
  const [selectedId, setSelectedId] = useState<number>();
  const [page, setPage] = useState(0);
  const selected =
    courses.data?.find((course) => course.id === selectedId) ??
    courses.data?.[0];
  const grades = useQuery({
    queryKey: ['my-grades', selected?.id],
    queryFn: async () =>
      unwrapData(
        await assignmentApiService.listMyGrades(selected!.id),
        'myGrades',
      ),
    enabled: selected != null,
    retry: false,
  });
  const released = (grades.data ?? []).filter((grade) => grade.released);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(released.length / 6) - 1),
  );
  return (
    <section aria-label={translate("settings:learning.released")}>
      <label className={styles.assessmentFilter}>
        {translate("common:fields.course")}<select
          value={selected?.id ?? ''}
          onChange={(event) => {
            setSelectedId(Number(event.target.value));
            setPage(0);
          }}
        >
          <option value="" disabled>
            {translate("settings:learning.selectCourse")}</option>
          {courses.data?.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title || course.courseCode}
            </option>
          ))}
        </select>
      </label>
      {courses.isPending || (selected && grades.isPending) ? (
        <p role="status">{translate("advising:studentWorkspace.loadingAssessments")}</p>
      ) : null}
      {courses.isError || grades.isError ? (
        <p role="alert">
          {translate("settings:learning.failed")}{' '}
          <button
            type="button"
            onClick={() =>
              void (courses.isError ? courses.refetch() : grades.refetch())
            }
          >
            {translate("common:actions.retry")}</button>
        </p>
      ) : null}
      {!courses.isPending &&
      !courses.isError &&
      (!selected || (grades.isSuccess && !released.length)) ? (
        <p className={styles.empty}>
          {translate("settings:learning.empty")}</p>
      ) : null}
      <div className={styles.assessmentCards}>
        {released.slice(currentPage * 6, currentPage * 6 + 6).map((grade) => (
          <article key={grade.assignmentId}>
            <ClipboardCheck size={27} aria-hidden="true" />
            <h3>{grade.assignmentTitle || grade.title || translate("exams:staff.assessment")}</h3>
            <small>{selected?.title}</small>
            <strong>
              {grade.gradeDisplay || (grade.score ?? grade.pointsEarned) != null
                ? grade.gradeDisplay ||
                  `${formatNumericText(grade.score ?? grade.pointsEarned)}${grade.pointsPossible != null ? ` / ${formatNumber(grade.pointsPossible)}` : ''}`
                : translate("settings:learning.noScore")}
            </strong>
            <small>
              {grade.releasedAt
                ? translate('settings:learning.releasedAt', {date: formatPlanDate(grade.releasedAt)})
                : translate("settings:learning.result")}
            </small>
            <Link
              to={generatePath(
                APP_ROUTE_PATHS.courseCourseIdAssignmentsAssignmentId,
                {
                  courseId: String(selected!.id),
                  assignmentId: String(grade.assignmentId),
                },
              )}
            >
              {translate("dashboard:viewFeedback")}</Link>
          </article>
        ))}
      </div>
      {released.length > 6 ? (
        <nav className={styles.assessmentPages} aria-label={translate("settings:learning.pages")}>
          <button
            type="button"
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            {translate("common:actions.previous")}</button>
          <span>
            {translate('common:pagination.pageOf', {page: formatNumber(currentPage + 1), total: formatNumber(Math.ceil(released.length / 6))})}
          </span>
          <button
            type="button"
            disabled={(currentPage + 1) * 6 >= released.length}
            onClick={() => setPage(currentPage + 1)}
          >
            {translate("common:actions.next")}</button>
        </nav>
      ) : null}
    </section>
  );
}
