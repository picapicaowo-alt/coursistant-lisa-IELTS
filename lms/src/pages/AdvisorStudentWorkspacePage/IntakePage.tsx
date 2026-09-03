import React from 'react';
import {useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import layout from './index.module.scss';
import {formatPersonName} from '@/utils/personName';
import {ParentLinksPanel} from '@/components/ParentLinksPanel';
import {WorkspaceSectionHeader} from '@/components/WorkspaceSectionHeader';

const AdvisorStudentIntakePage: React.FC = () => {
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const query = useQuery({meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorIntake(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudentIntake(id), 'advisorIntake'),
    enabled: Number.isInteger(id),
    // A hidden 404 is the final authorization result for a non-current
    // advisor. Retrying only delays the protected not-assigned state.
    retry: false,
  });

  if (query.isPending) return <p className={styles.status}>Loading intake…</p>;
  if (query.isError) return <p className={styles.error} role="alert">{advisingErrorMessage(query.error, 'Intake could not be loaded.')}</p>;
  const intake = query.data;

  return (
    <div className={layout.intakeGrid}>
    <section className={`${styles.card} ${layout.intakeMain}`}>
      <WorkspaceSectionHeader
        title="Counsellor intake"
        description="The intake captures the student's starting context at handover. It is read-only for Advisors."
        meta={<span className={styles.readOnlyBadge}>Read only</span>}
      />
      <dl className={styles.readonly}>
        <dt>Name</dt><dd>{formatPersonName(intake, '—')}</dd>
        <dt>Email</dt><dd>{intake.email || '—'}</dd>
        <dt>Student type</dt><dd>{intake.studentType || '—'}</dd>
        <dt>Course request</dt><dd>{intake.courseRequest || '—'}</dd>
        <dt>Phone</dt><dd>{intake.contactPhone || '—'}</dd>
        <dt>Background</dt><dd>{intake.basicBackground || '—'}</dd>
        <dt>Assignment</dt><dd>{intake.assignmentStatus} · version {intake.assignmentVersion ?? '—'}</dd>
      </dl>
    </section>
    <div className={layout.intakeSide}><ParentLinksPanel scope="advisor" subjectId={id}/></div>
    </div>
  );
};

export default AdvisorStudentIntakePage;
