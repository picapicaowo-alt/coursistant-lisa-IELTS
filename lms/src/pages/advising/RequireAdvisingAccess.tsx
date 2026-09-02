import React from 'react';
import {Navigate} from 'react-router-dom';
import type {LoginResponse} from '@/apis';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {
  getSignedInHomePath,
} from '@/utils/signedInHomePath';
import {
  isAdvisorAccount,
  isCounsellorAccount,
  isParentAccount,
  isStudentAccount,
  isTenantAdminAccount,
} from '@/utils/roleCapabilities';

type Gate = 'counsellor' | 'advisor' | 'student' | 'parent' | 'tenantAdmin';

const allowed: Record<Gate, (user: Pick<LoginResponse, 'role' | 'level'>) => boolean> = {
  counsellor: isCounsellorAccount,
  advisor: isAdvisorAccount,
  student: isStudentAccount,
  parent: isParentAccount,
  tenantAdmin: isTenantAdminAccount,
};

export const RequireAdvisingAccess = ({gate, children}: {gate: Gate; children: React.ReactNode}) => {
  const {user} = useRequiredAuth();
  if (!allowed[gate](user)) return <Navigate to={getSignedInHomePath(user)} replace/>;
  return children;
};
