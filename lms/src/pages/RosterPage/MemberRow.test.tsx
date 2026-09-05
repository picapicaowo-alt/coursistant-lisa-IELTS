import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import type {CourseMember} from '@/apis';
import {MemberRow} from './MemberRow';

const ta: CourseMember = {
  id: 3,
  courseId: 9,
  userId: 27,
  userName: 'Taylor Assistant',
  userEmail: 'taylor@example.test',
  courseRole: 'TA',
  active: true,
  canGrade: true,
  canPostAnnouncements: false,
  canManageGroups: false,
  canManageCourseEvents: true,
};

describe('MemberRow TA permissions', () => {
  it('renders a read-only TA without membership or permission actions', () => {
    render(<table><tbody><MemberRow member={ta} canManageMembers={false}
      onWithdraw={vi.fn()} onPromote={vi.fn()} onDemote={vi.fn()}
      onUpdatePermissions={vi.fn()} isBusy={false}/></tbody></table>);
    expect(screen.getByText('Taylor Assistant')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('edits and submits individual permission flags', async () => {
    const onUpdatePermissions = vi.fn();
    const user = userEvent.setup();

    render(
      <table><tbody><MemberRow
        member={ta}
        onWithdraw={vi.fn()}
        onPromote={vi.fn()}
        onDemote={vi.fn()}
        onUpdatePermissions={onUpdatePermissions}
        isBusy={false}
        canManageMembers
      /></tbody></table>,
    );

    await user.click(screen.getByRole('button', {name: 'Permissions'}));
    expect(screen.getByRole('dialog', {name: 'TA permissions'})).not.toBeNull();

    await user.click(screen.getByRole('checkbox', {name: /Manage announcements/}));
    await user.click(screen.getByRole('checkbox', {name: /Manage groups/}));
    await user.click(screen.getByRole('button', {name: 'Save permissions'}));

    expect(onUpdatePermissions).toHaveBeenCalledWith({
      canGrade: true,
      canPostAnnouncements: true,
      canManageGroups: true,
      canManageCourseEvents: true,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
