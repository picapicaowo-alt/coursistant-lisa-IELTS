import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, Clock3, FileCheck2} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import {unwrapData} from '@/apis';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {courseApiService} from '@/apis/services/course-api';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {formatCourseName} from '@/utils/course';
import {formatUtcTimestamp} from '@/utils/datetime';
import {formatGradePoints} from './gradeDisplay';
import styles from './index.module.scss';

const CourseGradesPage = () => {
  const {t: translate} = useTranslation();
  const {courseId: courseIdParam} = useParams();
  const courseId = Number(courseIdParam);
  const valid = Number.isInteger(courseId) && courseId > 0;
  const access = useCourseAccess(valid ? courseId : null);

  const courseQuery = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => unwrapData(await courseApiService.getCourse(courseId), 'getCourse'),
    enabled: valid && access.isResolved && access.isStudent,
    retry: 1,
  });
  const assignmentsQuery = useQuery({
    queryKey: ['course-my-grades', courseId],
    queryFn: async () => unwrapData(await assignmentApiService.listMyGrades(courseId), 'listMyGrades'),
    enabled: valid && access.isResolved && access.isStudent,
    retry: 1,
  });
  if (!valid) return <main className={styles.page}><p role="alert">Invalid course.</p></main>;
  if (access.isLoading) return <main className={styles.page}><p role="status">Loading grades…</p></main>;
  if (access.isResolved && !access.isStudent) {
    return <main className={styles.page}><p role="alert">This page shows a student&apos;s own grades only.</p></main>;
  }

  const loading = courseQuery.isPending || assignmentsQuery.isPending;
  const failed = courseQuery.isError || assignmentsQuery.isError;
  const assignments = assignmentsQuery.data ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} to={`/course/${courseId}`} aria-label={translate("course:grades.back")} title={translate("course:grades.back")}>
          <ArrowLeft aria-hidden="true"/>
        </Link>
        <div>
          <p className={styles.eyebrow}>Course grades</p>
          <h1>Grades</h1>
          {courseQuery.data ? (
            <p className={styles.courseName}>
              {formatCourseName(courseQuery.data.courseCode, courseQuery.data.title ?? courseQuery.data.name)}
            </p>
          ) : null}
        </div>
      </header>

      <section className={styles.notice} aria-label="Grade visibility information">
        <Clock3 aria-hidden="true"/>
        <p>{translate('course:grades.visibilityNotice')}</p>
      </section>

      {loading ? <p className={styles.status} role="status">Loading grades…</p> : null}
      {failed ? <p className={styles.error} role="alert">Some grades could not be loaded. Refresh to try again.</p> : null}

      {!loading ? (
        <div className={styles.sections}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <FileCheck2 aria-hidden="true"/>
              <div>
                <h2>Assignments</h2>
                <p>{assignments.length} item{assignments.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            {assignments.length === 0 ? <p className={styles.empty}>No published assignments.</p> : (
              <ul className={styles.gradeList}>
                {assignments.map(item => {
                  const title = item.assignmentTitle ?? item.title ?? `Assignment ${item.assignmentId}`;
                  const score = item.released
                    ? `${formatGradePoints(item.pointsEarned ?? item.score)} / ${formatGradePoints(item.pointsPossible)}`
                    : item.gradeDisplay === 'DashClosed' ? '—' : 'Not graded yet';
                  return (
                    <li key={item.assignmentId}>
                      <Link to={`/course/${courseId}/assignments/${item.assignmentId}`}>
                        <span className={styles.itemText}>
                          <strong>{title}</strong>
                          <small>
                            {item.submissionStatus ?? 'Not submitted'}
                            {item.dueAtUtc ? ` · Due ${formatUtcTimestamp(item.dueAtUtc)}` : ''}
                          </small>
                        </span>
                        <span className={item.released ? styles.releasedScore : styles.pendingScore}>{score}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

        </div>
      ) : null}
    </main>
  );
};

export default CourseGradesPage;
