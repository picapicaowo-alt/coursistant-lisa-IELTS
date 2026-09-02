import type {ReactNode} from 'react';
import {Navigate} from 'react-router-dom';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {isStudentAccount} from '@/utils/roleCapabilities';
import {getSignedInHomePath} from '@/utils/signedInHomePath';

export const RequireVocabularyStudent = ({children}: {children: ReactNode}) => {
  const {user} = useRequiredAuth();
  return isStudentAccount(user)
    ? children
    : <Navigate to={getSignedInHomePath(user)} replace/>;
};
