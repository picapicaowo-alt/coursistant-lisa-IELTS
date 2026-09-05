import { useTranslation } from 'react-i18next';
import React from 'react';
import {CourseMember} from '@/apis';
import {formatPersonName} from '@/utils/personName';
import styles from './index.module.scss';

interface MemberRowProps {
  member: CourseMember;
  onWithdraw: () => void;
  isBusy: boolean;
  canManageMembers: boolean;
}

export const MemberRow: React.FC<MemberRowProps> = ({member, onWithdraw, isBusy, canManageMembers}) => {
  const { t: translate } = useTranslation();
  const displayName = formatPersonName({
    firstName: member.userFirstName,
    middleName: member.userMiddleName,
    lastName: member.userLastName,
  }, member.userName || member.userEmail || translate("course:roster.unnamedMember"));
  const isStudent = member.courseRole === 'Student';
  return <>
    <tr className={member.active ? undefined : styles.withdrawnRow}>
      <td data-label={translate("common:fields.name")}>{displayName}</td>
      <td data-label={translate("common:fields.email")} className={styles.email}>{member.userEmail || '—'}</td>
      <td data-label={translate("course:roster.role")}><span className={`${styles.roleBadge} ${styles[`role${member.courseRole}`]}`}>{translate(`course:roster.roles.${member.courseRole}`)}</span></td>
      <td data-label={translate("common:fields.status")}>
        <span className={member.active ? styles.active : styles.withdrawn}>{member.active ? translate("common:status.ACTIVE") : translate("common:status.WITHDRAWN")}</span>
        {member.assignmentSubmitFrozen ? <span className={styles.frozen}>{translate("course:roster.submissionsFrozen")}</span> : null}
      </td>
      {canManageMembers ? <td data-label={translate("common:fields.actions")} className={styles.actions}>
        {isStudent && member.active ? <button type="button" className={styles.danger} disabled={isBusy} onClick={onWithdraw}>{translate("course:roster.withdrawAction")}</button> : null}
      </td> : null}
    </tr>
  </>;
};
