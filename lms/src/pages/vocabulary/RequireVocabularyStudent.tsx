import type {ReactNode} from 'react';
import {Navigate} from 'react-router-dom';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {isStudentLevel} from '@/utils/signedInHomePath';

export const RequireVocabularyStudent = ({children}: {children: ReactNode}) => {
  const {user} = useRequiredAuth();
  return isStudentLevel(user.level) ? children : <Navigate to="/" replace/>;
};
