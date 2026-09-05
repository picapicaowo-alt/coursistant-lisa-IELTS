import { useTranslation } from 'react-i18next';
import {useQueries, useQuery} from '@tanstack/react-query';
import {ArrowLeft, CheckCircle2, Clock3, FileCheck2} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import type {QuizResult} from '@/apis';
import {unwrapData} from '@/apis';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {courseApiService} from '@/apis/services/course-api';
import {quizApiService} from '@/apis/services/quiz-api';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {formatCourseName} from '@/utils/course';
import {formatUtcTimestamp} from '@/utils/datetime';
import {isMissingQuizResult} from '@/utils/quizAvailability';
import {formatGradePoints, quizGradeDisplay} from './gradeDisplay';
import styles from './index.module.scss';
import {statusLabel} from '@/i18n/presentation';

const CourseGradesPage = () => {
  const { t: translate } = useTranslation();
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
  const quizzesQuery = useQuery({
    queryKey: ['course-quizzes', courseId],
    queryFn: async () => unwrapData(await quizApiService.listQuizzes(courseId), 'listQuizzes'),
    enabled: valid && access.isResolved && access.isStudent,
    retry: 1,
  });
  const quizzes = quizzesQuery.data ?? [];
  const quizResultQueries = useQueries({
    queries: quizzes.map(quiz => ({
      queryKey: ['quiz-my-result', courseId, quiz.id],
      queryFn: async (): Promise<QuizResult | null> => {
        try {
          return unwrapData(await quizApiService.getMyResult(courseId, quiz.id), 'getMyResult');
        } catch (error) {
          if (isMissingQuizResult(error)) return null;
          throw error;
        }
      },
      enabled: valid && access.isResolved && access.isStudent,
      retry: false,
    })),
  });

  if (!valid) return <main className={styles.page}><p role="alert">{translate("course:grades.invalid")}</p></main>;
  if (access.isLoading) return <main className={styles.page}><p role="status">{translate("course:grades.loading")}</p></main>;
  if (access.isResolved && !access.isStudent) {
    return <main className={styles.page}><p role="alert">{translate("course:grades.ownOnly")}</p></main>;
  }

  const loading = courseQuery.isPending || assignmentsQuery.isPending || quizzesQuery.isPending
    || quizResultQueries.some(query => query.isPending);
  const failed = courseQuery.isError || assignmentsQuery.isError || quizzesQuery.isError
    || quizResultQueries.some(query => query.isError);
  const assignments = assignmentsQuery.data ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} to={`/course/${courseId}`} aria-label={translate("course:grades.back")} title={translate("course:grades.back")}>
          <ArrowLeft aria-hidden="true"/>
        </Link>
        <div>
          <p className={styles.eyebrow}>{translate("course:grades.title")}</p>
          <h1>{translate("course:grades.label")}</h1>
          {courseQuery.data ? (
            <p className={styles.courseName}>
              {formatCourseName(courseQuery.data.courseCode, courseQuery.data.title ?? courseQuery.data.name)}
            </p>
          ) : null}
        </div>
      </header>

      <section className={styles.notice} aria-label={translate("course:grades.visibility")}>
        <Clock3 aria-hidden="true"/>
        <p>{translate("course:grades.visibilityHelp")}</p>
      </section>

      {loading ? <p className={styles.status} role="status">{translate("course:grades.loading")}</p> : null}
      {failed ? <p className={styles.error} role="alert">{translate("course:grades.partialFailure")}</p> : null}

      {!loading ? (
        <div className={styles.sections}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <FileCheck2 aria-hidden="true"/>
              <div>
                <h2>{translate("course:detail.assignments")}</h2>
                <p>{translate('course:grades.itemCount', {count: assignments.length})}</p>
              </div>
            </div>
            {assignments.length === 0 ? <p className={styles.empty}>{translate("course:grades.noAssignments")}</p> : (
              <ul className={styles.gradeList}>
                {assignments.map(item => {
                  const title = item.assignmentTitle ?? item.title ?? translate('course:grades.assignmentFallback', {id: item.assignmentId});
                  const score = item.released
                    ? `${formatGradePoints(item.pointsEarned ?? item.score)} / ${formatGradePoints(item.pointsPossible)}`
                    : item.gradeDisplay === 'DashClosed' ? '—' : translate('course:grades.notGraded');
                  return (
                    <li key={item.assignmentId}>
                      <Link to={`/course/${courseId}/assignments/${item.assignmentId}`}>
                        <span className={styles.itemText}>
                          <strong>{title}</strong>
                          <small>
                            {statusLabel(item.submissionStatus ?? 'NOT_SUBMITTED')}
                            {item.dueAtUtc ? <> · {translate('course:grades.due', {date: formatUtcTimestamp(item.dueAtUtc)})}</> : null}
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

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <CheckCircle2 aria-hidden="true"/>
              <div>
                <h2>{translate("course:detail.quizzes")}</h2>
                <p>{translate('course:grades.itemCount', {count: quizzes.length})}</p>
              </div>
            </div>
            {quizzes.length === 0 ? <p className={styles.empty}>{translate("course:grades.noQuizzes")}</p> : (
              <ul className={styles.gradeList}>
                {quizzes.map((quiz, index) => {
                  const result = quizResultQueries[index]?.data ?? null;
                  const display = quizGradeDisplay(quiz, result);
                  const visibleScore = result !== null && (
                    result.totalScore !== null
                    || (quiz.resultVisibility === 'InstantAutoScore' && result.autoScore !== null)
                  );
                  return (
                    <li key={quiz.id}>
                      <Link to={`/course/${courseId}/quizzes/${quiz.id}`}>
                        <span className={styles.itemText}>
                          <strong>{quiz.title}</strong>
                          <small>{result ? translate("common:status.SUBMITTED") : translate("common:status.NOT_SUBMITTED")} · {quiz.resultVisibility === 'InstantAutoScore' ? translate("course:grades.instant") : translate("course:grades.afterRelease")}</small>
                        </span>
                        <span className={visibleScore ? styles.releasedScore : styles.pendingScore}>{display}</span>
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
