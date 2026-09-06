import {lazy, Suspense} from 'react';
import {Navigate} from 'react-router-dom';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {useTranslation} from 'react-i18next';

const SystemAdminConsole = lazy(() => import('@/pages/AdminConsolePage'));
const TenantAdminPage = lazy(() => import('@/pages/TenantAdminPage'));

const AdminLandingPage = () => {
  const {t} = useTranslation();
  const {user} = useRequiredAuth();
  if (user.role === 'TENANT_ADMIN') return <Suspense fallback={<p role="status">{t('common:feedback.loading')}</p>}><TenantAdminPage/></Suspense>;
  if (user.role === 'SYSTEM_ADMIN') return <Suspense fallback={<p role="status">{t('common:feedback.loading')}</p>}><SystemAdminConsole/></Suspense>;
  return <Navigate to="/" replace/>;
};

export default AdminLandingPage;
