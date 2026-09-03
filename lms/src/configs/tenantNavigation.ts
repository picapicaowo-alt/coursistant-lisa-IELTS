import {generatePath} from 'react-router-dom';
import {APP_ROUTE_PATHS} from './routePaths';

export const TENANT_PAGE_SIZE = 20;
export const TENANT_ADVISOR_LEVELS = ['ADVISOR', 'INSTRUCTOR_ADVISOR'] as const;
export const TENANT_PATHS = {
  dashboard: APP_ROUTE_PATHS.adminDashboard,
  governance: APP_ROUTE_PATHS.admin,
  people: APP_ROUTE_PATHS.admin,
  ownership: `${APP_ROUTE_PATHS.admin}?section=ownership`,
  alerts: `${APP_ROUTE_PATHS.admin}?section=alerts`,
  audit: `${APP_ROUTE_PATHS.admin}?section=audit`,
  createAccount: `${APP_ROUTE_PATHS.admin}?action=create`,
  intakes: APP_ROUTE_PATHS.adminIntakes,
  createIntake: `${APP_ROUTE_PATHS.adminIntakes}?action=create`,
  templates: APP_ROUTE_PATHS.mockExams,
  createTemplate: `${APP_ROUTE_PATHS.mockExams}?action=create`,
  student: (id: number) => generatePath(APP_ROUTE_PATHS.adminStudentsStudentUserId, {studentUserId: String(id)}),
};
