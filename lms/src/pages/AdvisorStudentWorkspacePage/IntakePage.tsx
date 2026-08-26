import React from 'react';
import {useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';

const AdvisorStudentIntakePage: React.FC = () => {
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const query = useQuery({
    queryKey: advisingQueryKeys.advisorIntake(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudentIntake(id), 'advisorIntake'),
    enabled: Number.isInteger(id),
  });

  if (query.isPending) return <p className={styles.status}>Loading intake…</p>;
  if (query.isError) return <p className={styles.error} role="alert">{advisingErrorMessage(query.error, 'Intake could not be loaded.')}</p>;
  const intake = query.data;

  return (
    <section className={styles.card}>
      <h2>Counsellor intake</h2>
      <dl className={styles.readonly}>
        <dt>Name</dt><dd>{intake.name || '—'}</dd>
        <dt>Email</dt><dd>{intake.email || '—'}</dd>
        <dt>Student type</dt><dd>{intake.studentType || '—'}</dd>
        <dt>Course request</dt><dd>{intake.courseRequest || '—'}</dd>
        <dt>Phone</dt><dd>{intake.contactPhone || '—'}</dd>
        <dt>Background</dt><dd>{intake.basicBackground || '—'}</dd>
        <dt>Assignment</dt><dd>{intake.assignmentStatus} · version {intake.assignmentVersion ?? '—'}</dd>
      </dl>
    </section>
  );
};

export default AdvisorStudentIntakePage;
