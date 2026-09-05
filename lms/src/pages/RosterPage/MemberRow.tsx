import { useTranslation } from 'react-i18next';
import React, {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {CourseMember, TaPermissions} from '@/apis';
import {TeachingDialog} from '@/components/TeachingWorkspace';
import {formatPersonName} from '@/utils/personName';
import styles from './index.module.scss';

interface MemberRowProps {
  member: CourseMember;
  onWithdraw: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onUpdatePermissions: (permissions: TaPermissions) => void;
  isBusy: boolean;
  canManageMembers: boolean;
}

const permissionsFromMember = (member: CourseMember): Required<TaPermissions> => ({
  canGrade: Boolean(member.canGrade),
  canPostAnnouncements: Boolean(member.canPostAnnouncements),
  canManageGroups: Boolean(member.canManageGroups),
  canManageCourseEvents: Boolean(member.canManageCourseEvents),
});

const PERMISSION_OPTIONS: Array<{key: keyof Required<TaPermissions>; label: string; description: string}> = [
  {key: 'canGrade', label: 'Grade coursework', description: 'View submissions and save or release grades.'},
  {key: 'canPostAnnouncements', label: 'Manage announcements', description: 'Create, edit, and remove course announcements.'},
  {key: 'canManageGroups', label: 'Manage groups', description: 'Create group sets and manage group membership.'},
  {key: 'canManageCourseEvents', label: 'Manage schedule and events', description: 'Create, edit, and delete sessions and course events.'},
];

export const MemberRow: React.FC<MemberRowProps> = ({member, onWithdraw, onPromote, onDemote, onUpdatePermissions, isBusy, canManageMembers}) => {
  const { t: translate } = useTranslation();
  const displayName = formatPersonName({
    firstName: member.userFirstName,
    middleName: member.userMiddleName,
    lastName: member.userLastName,
  }, member.userName || member.userEmail || translate("course:roster.unnamedMember"));
  const isStudent = member.courseRole === 'Student';
  const isTa = member.courseRole === 'TA';
  const canPromote = isStudent && member.active && member.level === 'STUDENT';
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [permissions, setPermissions] = useState<Required<TaPermissions>>(() => permissionsFromMember(member));

  useEffect(() => setPermissions(permissionsFromMember(member)), [member]);

  const savePermissions = () => {
    onUpdatePermissions(permissions);
    setPermissionOpen(false);
  };

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
        {canPromote ? <button type="button" disabled={isBusy} onClick={onPromote}>Make TA</button> : null}
        {isTa ? <button type="button" disabled={isBusy} onClick={() => setPermissionOpen(true)}>Permissions</button> : null}
        {isTa ? <button type="button" disabled={isBusy} onClick={onDemote}>Remove TA</button> : null}
        {isStudent && member.active ? <button type="button" className={styles.danger} disabled={isBusy} onClick={onWithdraw}>Withdraw</button> : null}
      </td> : null}
    </tr>
    {permissionOpen && canManageMembers ? createPortal(
          <TeachingDialog title="TA permissions" description={displayName} busy={isBusy} onClose={() => setPermissionOpen(false)}>
              <div className={styles.permissionList}>
                {PERMISSION_OPTIONS.map(option => (
                  <label key={option.key} className={styles.permissionOption}>
                    <input type="checkbox" checked={permissions[option.key]} onChange={event => setPermissions(current => ({...current, [option.key]: event.target.checked}))}/>
                    <span><strong>{option.label}</strong><small>{option.description}</small></span>
                  </label>
                ))}
              </div>
              <div className={styles.dialogActions}>
                <button type="button" onClick={() => setPermissionOpen(false)}>{translate("common:actions.cancel")}</button>
                <button type="button" className={styles.primary} disabled={isBusy} onClick={savePermissions}>Save permissions</button>
              </div>
          </TeachingDialog>,
          document.body,
        ) : null}
  </>;
};
