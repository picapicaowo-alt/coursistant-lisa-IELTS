import React from 'react';
import {Navigate, Outlet} from 'react-router-dom';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {getSignedInHomePath} from '@/utils/signedInHomePath';
import {
  canAccessCourseCatalogue,
  canAccessMyOperations,
  canAccessStandaloneMockExams,
  canTakeMockExam,
} from '@/utils/roleCapabilities';

type Capability = 'courses' | 'myOperations' | 'mockExams' | 'mockExamSession';

const allowed: Record<Capability, (identity: ReturnType<typeof useRequiredAuth>['user']) => boolean> = {
  courses: canAccessCourseCatalogue,
  myOperations: canAccessMyOperations,
  mockExams: canAccessStandaloneMockExams,
  mockExamSession: canTakeMockExam,
};

export const RequireRoleAccess = ({capability, children}: {capability: Capability; children?: React.ReactNode}) => {
  const {user} = useRequiredAuth();
  if (!allowed[capability](user)) return <Navigate to={getSignedInHomePath(user)} replace/>;
  return children ?? <Outlet/>;
};
