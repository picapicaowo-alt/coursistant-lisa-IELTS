import {lazy, Suspense} from 'react';
import {Navigate} from 'react-router-dom';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';

const SystemAdminConsole = lazy(() => import('@/pages/AdminConsolePage'));
const TenantAdminPage = lazy(() => import('@/pages/TenantAdminPage'));

const AdminLandingPage = () => {
  const {user} = useRequiredAuth();
  if (user.role === 'TENANT_ADMIN') return <Suspense fallback={<p role="status">Loading tenant governance…</p>}><TenantAdminPage/></Suspense>;
  if (user.role === 'SYSTEM_ADMIN') return <Suspense fallback={<p role="status">Loading system administration…</p>}><SystemAdminConsole/></Suspense>;
  return <Navigate to="/" replace/>;
};

export default AdminLandingPage;
