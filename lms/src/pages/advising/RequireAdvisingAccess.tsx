import React from 'react';
import {Navigate} from 'react-router-dom';
import type {LoginResponse} from '@/apis';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {
  getSignedInHomePath,
  isAdvisorLevel,
  isCounsellorLevel,
  isStudentLevel,
  isTenantAdminRole,
} from '@/utils/signedInHomePath';

type Gate = 'counsellor' | 'advisor' | 'student' | 'tenantAdmin';

const allowed: Record<Gate, (user: Pick<LoginResponse, 'role' | 'level'>) => boolean> = {
  counsellor: user => isCounsellorLevel(user.level),
  advisor: user => isAdvisorLevel(user.level),
  student: user => isStudentLevel(user.level),
  tenantAdmin: user => isTenantAdminRole(user.role),
};

export const RequireAdvisingAccess = ({gate, children}: {gate: Gate; children: React.ReactNode}) => {
  const {user} = useRequiredAuth();
  if (!allowed[gate](user)) return <Navigate to={getSignedInHomePath(user)} replace/>;
  return children;
};
