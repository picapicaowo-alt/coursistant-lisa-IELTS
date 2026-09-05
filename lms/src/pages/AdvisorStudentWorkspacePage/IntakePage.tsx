import { useTranslation } from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
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
import {WorkspaceSection} from '@/components/WorkspaceSection';

const AdvisorStudentIntakePage: React.FC = () => {
  const { t: translate } = useTranslation();
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

  if (query.isPending) return <p className={styles.status}>{translate("advising:studentIntake.loading")}</p>;
  if (query.isError) return <p className={styles.error} role="alert">{advisingErrorMessage(query.error, translate('advising:studentWorkspace.intakeFailed'))}</p>;
  const intake = query.data;

  return (
    <div className={layout.intakeGrid}>
    <WorkspaceSection appearance="record" className={layout.intakeMain}
        title={translate("advising:studentIntake.title")}
        meta={<span className={styles.readOnlyBadge}>{translate("courseTools:owner.readOnly")}</span>}
      >
      <p className={layout.intakeDescription}>{translate("advising:studentIntake.description")}</p>
      <dl className={layout.intakeRecord}>
        <div><dt>{translate("common:fields.name")}</dt><dd>{formatPersonName(intake, '—')}</dd></div>
        <div><dt>{translate("common:fields.email")}</dt><dd>{intake.email || '—'}</dd></div>
        <div><dt>{translate("advising:actionTasks.studentType")}</dt><dd>{intake.studentType ? statusLabel(intake.studentType) : '—'}</dd></div>
        <div><dt>{translate("advising:studentIntake.courseRequest")}</dt><dd>{intake.courseRequest || '—'}</dd></div>
        <div><dt>{translate("settings:phone")}</dt><dd>{intake.contactPhone || '—'}</dd></div>
        <div><dt>{translate("advising:studentIntake.background")}</dt><dd>{intake.basicBackground || '—'}</dd></div>
        <div><dt>{translate("advising:studentIntake.assignment")}</dt><dd>{translate('advising:studentIntake.assignmentVersion', {status: intake.assignmentStatus ? statusLabel(intake.assignmentStatus) : translate('advising:studentIntake.unassigned'), number: intake.assignmentVersion == null ? '—' : formatNumber(intake.assignmentVersion)})}</dd></div>
      </dl>
    </WorkspaceSection>
    <div className={layout.intakeSide}><ParentLinksPanel scope="advisor" subjectId={id} presentation="panel"/></div>
    </div>
  );
};

export default AdvisorStudentIntakePage;
