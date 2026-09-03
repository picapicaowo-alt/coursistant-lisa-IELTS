import {generatePath} from 'react-router-dom';

export const ASSIGNMENT_GRADING_ROUTE = '/course/:courseId/assignments/:assignmentId/grading';

/** Queue links are built from record IDs; backend deep links may target a different client. */
export const assignmentGradingPath = (courseId: number, assignmentId: number): string =>
  generatePath(ASSIGNMENT_GRADING_ROUTE, {courseId: String(courseId), assignmentId: String(assignmentId)});
