import React from 'react';
import {Navigate, Outlet} from 'react-router-dom';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {getSignedInHomePath} from '@/utils/signedInHomePath';
import {
  canAccessAdminConsole,
  canAccessAiWorkspace,
  canAccessCalendar,
  canAccessCourseCatalogue,
  canAccessCourseAuthoringTools,
  canAccessDashboard,
  canAccessMyOperations,
  canAccessStandaloneMockExams,
  canTakeMockExam,
  canCreateCourses,
} from '@/utils/roleCapabilities';

type Capability =
  | 'dashboard'
  | 'courses'
  | 'courseCreation'
  | 'courseAuthoring'
  | 'calendar'
  | 'aiWorkspace'
  | 'myOperations'
  | 'mockExams'
  | 'mockExamSession'
  | 'adminConsole';

const allowed: Record<Capability, (identity: ReturnType<typeof useRequiredAuth>['user']) => boolean> = {
  dashboard: canAccessDashboard,
  courses: canAccessCourseCatalogue,
  courseCreation: canCreateCourses,
  courseAuthoring: canAccessCourseAuthoringTools,
  calendar: canAccessCalendar,
  aiWorkspace: canAccessAiWorkspace,
  myOperations: canAccessMyOperations,
  mockExams: canAccessStandaloneMockExams,
  mockExamSession: canTakeMockExam,
  adminConsole: canAccessAdminConsole,
};

export const RequireRoleAccess = ({capability, children}: {capability: Capability; children?: React.ReactNode}) => {
  const {user} = useRequiredAuth();
  if (!allowed[capability](user)) return <Navigate to={getSignedInHomePath(user)} replace/>;
  return children ?? <Outlet/>;
};
