import React, {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {CourseMember, TaPermissions} from '@/apis';
import {formatPersonName} from '@/utils/personName';
import styles from './index.module.scss';

interface MemberRowProps {
  member: CourseMember;
  onWithdraw: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onUpdatePermissions: (permissions: TaPermissions) => void;
  isBusy: boolean;
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

export const MemberRow: React.FC<MemberRowProps> = ({member, onWithdraw, onPromote, onDemote, onUpdatePermissions, isBusy}) => {
  const displayName = formatPersonName({
    firstName: member.userFirstName,
    middleName: member.userMiddleName,
    lastName: member.userLastName,
  }, member.userName || member.userEmail || 'Unnamed member');
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
      <td data-label="Name">{displayName}</td>
      <td data-label="Email" className={styles.email}>{member.userEmail || '—'}</td>
      <td data-label="Role"><span className={`${styles.roleBadge} ${styles[`role${member.courseRole}`]}`}>{member.courseRole}</span></td>
      <td data-label="Status">
        <span className={member.active ? styles.active : styles.withdrawn}>{member.active ? 'Active' : 'Withdrawn'}</span>
        {member.assignmentSubmitFrozen ? <span className={styles.frozen}>Submissions frozen</span> : null}
      </td>
      <td data-label="Actions" className={styles.actions}>
        {canPromote ? <button type="button" disabled={isBusy} onClick={onPromote}>Make TA</button> : null}
        {isTa ? <button type="button" disabled={isBusy} onClick={() => setPermissionOpen(true)}>Permissions</button> : null}
        {isTa ? <button type="button" disabled={isBusy} onClick={onDemote}>Remove TA</button> : null}
        {isStudent && member.active ? <button type="button" className={styles.danger} disabled={isBusy} onClick={onWithdraw}>Withdraw</button> : null}
      </td>
    </tr>
    {permissionOpen ? createPortal(
          <div className={styles.dialogBackdrop} role="presentation" onMouseDown={() => setPermissionOpen(false)}>
            <section className={styles.permissionDialog} role="dialog" aria-modal="true" aria-labelledby={`ta-permissions-${member.userId}`} onMouseDown={event => event.stopPropagation()}>
              <div className={styles.dialogHeader}>
                <div><h2 id={`ta-permissions-${member.userId}`}>TA permissions</h2><p>{displayName}</p></div>
                <button type="button" className={styles.closeButton} aria-label="Close permissions" onClick={() => setPermissionOpen(false)}>×</button>
              </div>
              <div className={styles.permissionList}>
                {PERMISSION_OPTIONS.map(option => (
                  <label key={option.key} className={styles.permissionOption}>
                    <input type="checkbox" checked={permissions[option.key]} onChange={event => setPermissions(current => ({...current, [option.key]: event.target.checked}))}/>
                    <span><strong>{option.label}</strong><small>{option.description}</small></span>
                  </label>
                ))}
              </div>
              <div className={styles.dialogActions}>
                <button type="button" onClick={() => setPermissionOpen(false)}>Cancel</button>
                <button type="button" className={styles.primary} disabled={isBusy} onClick={savePermissions}>Save permissions</button>
              </div>
            </section>
          </div>,
          document.body,
        ) : null}
  </>;
};
