import React from 'react';
import {useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {ParentLinksPanel} from '@/components/ParentLinksPanel';
import {adminApiService} from '@/apis/services/admin-api';
import {normalizeManagedUser} from '@/pages/AdminConsolePage/adminDirectory';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';

const TenantStudentRecordPage: React.FC = () => {
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const user = useQuery({
    queryKey: ['tenant', 'users', id],
    queryFn: async () => normalizeManagedUser(
      unwrapData(await adminApiService.getTenantUser(id), 'tenantUser'),
    ),
    enabled: Number.isInteger(id) && id > 0,
    retry: false,
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Tenant admin</p>
          <h1>{formatPersonName(user.data, `Student #${id}`)}</h1>
          <p className={styles.lede}>Account identity and Parent links for this tenant.</p>
        </div>
      </header>
      <section className={styles.card}>
        <h2>Account</h2>
        {user.isPending ? <p className={styles.status}>Loading account…</p> : null}
        {user.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(user.error, 'Account could not be loaded.')}</p> : null}
        {user.isSuccess && !user.data ? <p className={styles.error} role="alert">The directory returned an unsupported account payload.</p> : null}
        {user.data ? <dl className={styles.readonly}>
          <dt>Email</dt><dd>{user.data.email}</dd>
          <dt>Identity</dt><dd>{user.data.role} / {user.data.level}</dd>
          <dt>Status</dt><dd>{user.data.status}</dd>
        </dl> : null}
      </section>
      <ParentLinksPanel scope="tenant" subjectId={id}/>
    </main>
  );
};

export default TenantStudentRecordPage;
