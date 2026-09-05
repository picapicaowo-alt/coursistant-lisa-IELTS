import React from 'react';
import {LoginResponse} from "@/apis";
import {Navigate} from "react-router-dom";
import {useAuth} from "@/contexts/AuthContext";
import {useTranslation} from 'react-i18next';

interface RequiredAuthContextValue {
  user: LoginResponse;
}

const RequiredAuthContext = React.createContext<RequiredAuthContextValue | null>(null);

interface RequiredAuthProviderProps {
  children: React.ReactNode;
}

export const RequiredAuthProvider = ({children}: RequiredAuthProviderProps) => {
  const {t} = useTranslation('common');
  const {user, loading} = useAuth();

  if (loading) {
    return <div role="status">{t('feedback.loadingSession')}</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace/>;
  }
  
  return (
    <RequiredAuthContext.Provider value={{user}}>
      {children}
    </RequiredAuthContext.Provider>
  );
};

export const useRequiredAuth = () => {
  const context = React.useContext(RequiredAuthContext);
  if (!context) {
    throw new Error('useRequiredAuth must be used within a RequiredAuthProvider');
  }
  return context;
};
