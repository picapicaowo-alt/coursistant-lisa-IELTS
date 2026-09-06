import { useTranslation } from 'react-i18next';
import type {QuizResponse} from '@/apis';
import {Link} from 'react-router-dom';
import {formatQuizInstant, quizWindowStatus, quizWindowStatusLabel} from '@/utils/quizAvailability';
import styles from './index.module.scss';

interface Props {
  courseId: number;
  quizzes: QuizResponse[];
  failed: boolean;
  canCreate?: boolean;
}

const QuizWindowMeta = ({quiz}: {quiz: QuizResponse}) => {
  const { t: translate } = useTranslation();
  const status = quizWindowStatus(quiz);
  const opens = formatQuizInstant(quiz.opensAtLocal, quiz.timezone);
  const closes = formatQuizInstant(quiz.closesAtLocal, quiz.timezone);

  if (status === 'closed') {
    return (
      <span className={styles.quizWindow}>
        <span className={styles.quizWindowLabel}>{translate("common:status.CLOSED")}</span>
        <span className={styles.quizWindowValue}>{closes}</span>
      </span>
    );
  }

  return (
    <span className={styles.quizWindow}>
      <span className={styles.quizWindowLabel}>{translate("assessment:quiz.opens")}</span>
      <span className={styles.quizWindowValue}>{opens}</span>
      <span className={styles.quizWindowLabel}>{translate("assessment:quiz.closes")}</span>
      <span className={styles.quizWindowValue}>{closes}</span>
    </span>
  );
};

export const QuizzesCard = ({courseId, quizzes, failed, canCreate = false}: Props) => {
  const { t: translate } = useTranslation();
  return (
  <section className={styles.card}>
    <div className={styles.cardHeader}>
      <h2 className={styles.cardTitle}>{translate("course:detail.quizzes")}</h2>
      {canCreate ? <Link to={`/course/${courseId}/quizzes/new`} className={styles.addButton}>{translate("course:workspace.addQuiz")}</Link> : null}
    </div>

    {failed ? (
      <p className={styles.cardEmpty} role="alert">{translate("course:workspace.quizzesFailed")}</p>
    ) : quizzes.length === 0 ? (
      <p className={styles.cardEmpty}>{translate("course:workspace.quizzesEmpty")}</p>
    ) : (
      <ul className={styles.rowList}>
        {quizzes.map(quiz => {
          const status = quizWindowStatus(quiz);
          return (
            <li key={quiz.id} className={styles.row}>
              <Link to={`/course/${courseId}/quizzes/${quiz.id}`} className={styles.rowLink}>
                <span className={styles.stateTag} data-status={status}>{quizWindowStatusLabel(status)}</span>
                <span className={styles.rowTitle}>{quiz.title}</span>
                <QuizWindowMeta quiz={quiz}/>
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
};
