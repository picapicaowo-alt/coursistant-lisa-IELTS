import React from 'react';
import {useTranslation} from 'react-i18next';
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
import {WorkspaceSection} from '@/components/WorkspaceSection';

const AdvisorStudentIntakePage: React.FC = () => {
  const {t} = useTranslation('advising');
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
    <WorkspaceSection appearance="record" className={layout.intakeMain}
        title="Counsellor intake"
        meta={<span className={styles.readOnlyBadge}>Read only</span>}
      >
      <p className={layout.intakeDescription}>{t('studentIntake.description')}</p>
      <dl className={layout.intakeRecord}>
        <div><dt>Name</dt><dd>{formatPersonName(intake, '—')}</dd></div>
        <div><dt>Email</dt><dd>{intake.email || '—'}</dd></div>
        <div><dt>Student type</dt><dd>{intake.studentType || '—'}</dd></div>
        <div><dt>Course request</dt><dd>{intake.courseRequest || '—'}</dd></div>
        <div><dt>Phone</dt><dd>{intake.contactPhone || '—'}</dd></div>
        <div><dt>Background</dt><dd>{intake.basicBackground || '—'}</dd></div>
        <div><dt>Assignment</dt><dd>{intake.assignmentStatus === 'ASSIGNED' ? 'Assigned' : 'Unassigned'} · version {intake.assignmentVersion ?? '—'}</dd></div>
      </dl>
    </WorkspaceSection>
    <div className={layout.intakeSide}><ParentLinksPanel scope="advisor" subjectId={id} presentation="panel"/></div>
    </div>
  );
};

export default AdvisorStudentIntakePage;
