import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import type {CourseMember} from '@/apis';
import '@/i18n';
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

describe('IELTS member actions', () => {
  it.each([false, true])('never offers TA controls with canManageMembers=%s', canManageMembers => {
    render(<table><tbody><MemberRow member={ta} canManageMembers={canManageMembers}
      onWithdraw={vi.fn()} isBusy={false}/></tbody></table>);
    expect(screen.getByText('Taylor Assistant')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('preserves student withdrawal for course managers without TA promotion', async () => {
    const onWithdraw = vi.fn();
    render(<table><tbody><MemberRow member={{...ta, courseRole: 'Student', level: 'STUDENT'}}
      canManageMembers onWithdraw={onWithdraw} isBusy={false}/></tbody></table>);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', {name: 'Withdraw'}));
    expect(onWithdraw).toHaveBeenCalledOnce();
  });
});
