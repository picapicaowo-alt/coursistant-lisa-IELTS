import type {QuizResponse, QuizResult} from '@/apis';
import i18n from '@/i18n';
import {formatNumber} from '@/i18n/formatting';

export const formatGradePoints = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  return formatNumber(value, {maximumFractionDigits: 2});
};

export const quizGradeDisplay = (quiz: QuizResponse, result: QuizResult | null): string => {
  if (!result) return i18n.t('common:status.NOT_SUBMITTED');
  if (result.totalScore !== null) {
    return `${formatGradePoints(result.totalScore)} / ${formatGradePoints(quiz.totalPoints)}`;
  }
  if (quiz.resultVisibility === 'InstantAutoScore' && result.autoScore !== null) {
    const prefix = i18n.t(result.manualGradingPending ? 'course:grades.autoScoreSoFar' : 'course:grades.autoScore');
    return `${prefix}: ${formatGradePoints(result.autoScore)} / ${formatGradePoints(quiz.totalPoints)}`;
  }
  return i18n.t('course:grades.notGraded');
};
