import React from 'react';
import {LoginResponse} from "@/apis";
import {Navigate} from "react-router-dom";
import {useAuth} from "@/contexts/AuthContext";

interface RequiredAuthContextValue {
  user: LoginResponse;
}

const RequiredAuthContext = React.createContext<RequiredAuthContextValue | null>(null);

interface RequiredAuthProviderProps {
  children: React.ReactNode;
}

export const RequiredAuthProvider = ({children}: RequiredAuthProviderProps) => {
  const {user, loading} = useAuth();

  if (loading) {
    return <div role="status">Loading session…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace/>;
  }
  
  return (
    <RequiredAuthContext.Provider key={`${user.userId}:${user.role}:${user.level}`} value={{user}}>
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
