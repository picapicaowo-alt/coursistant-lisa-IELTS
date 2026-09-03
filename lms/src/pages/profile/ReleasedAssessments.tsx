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
    <section aria-label="Released assessments">
      <label className={styles.assessmentFilter}>
        Course
        <select
          value={selected?.id ?? ''}
          onChange={(event) => {
            setSelectedId(Number(event.target.value));
            setPage(0);
          }}
        >
          <option value="" disabled>
            Select course
          </option>
          {courses.data?.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title || course.courseCode}
            </option>
          ))}
        </select>
      </label>
      {courses.isPending || (selected && grades.isPending) ? (
        <p role="status">Loading assessments…</p>
      ) : null}
      {courses.isError || grades.isError ? (
        <p role="alert">
          Assessments could not be loaded.{' '}
          <button
            type="button"
            onClick={() =>
              void (courses.isError ? courses.refetch() : grades.refetch())
            }
          >
            Retry
          </button>
        </p>
      ) : null}
      {!courses.isPending &&
      !courses.isError &&
      (!selected || (grades.isSuccess && !released.length)) ? (
        <p className={styles.empty}>
          No released assessments for this course yet.
        </p>
      ) : null}
      <div className={styles.assessmentCards}>
        {released.slice(currentPage * 6, currentPage * 6 + 6).map((grade) => (
          <article key={grade.assignmentId}>
            <ClipboardCheck size={27} aria-hidden="true" />
            <h3>{grade.assignmentTitle || grade.title || 'Assessment'}</h3>
            <small>{selected?.title}</small>
            <strong>
              {grade.gradeDisplay || (grade.score ?? grade.pointsEarned) != null
                ? grade.gradeDisplay ||
                  `${grade.score ?? grade.pointsEarned}${grade.pointsPossible != null ? ` / ${grade.pointsPossible}` : ''}`
                : 'Score not provided'}
            </strong>
            <small>
              {grade.releasedAt
                ? `Released ${formatPlanDate(grade.releasedAt)}`
                : 'Released result'}
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
              View feedback
            </Link>
          </article>
        ))}
      </div>
      {released.length > 6 ? (
        <nav className={styles.assessmentPages} aria-label="Assessment pages">
          <button
            type="button"
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            Page {currentPage + 1} of {Math.ceil(released.length / 6)}
          </span>
          <button
            type="button"
            disabled={(currentPage + 1) * 6 >= released.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
}
