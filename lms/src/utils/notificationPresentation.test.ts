import {afterEach, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {getNotificationMessage} from './notificationPresentation';

afterEach(() => i18n.changeLanguage('en'));
const message = 'Server fallback';

describe('structured notification messages', () => {
  it.each(['en', 'zh-CN', 'zh-TW'])('localizes known variables in %s without rewriting authored titles', async locale => {
    await i18n.changeLanguage(locale);
    expect(getNotificationMessage({notificationType: 'ASSIGNMENT_PUBLISHED', message, templateVars: {assignmentTitle: 'Authored {{title}} <b> & text'}})).toBe(i18n.t('notification:messages.ASSIGNMENT_PUBLISHED', {assignmentTitle: 'Authored {{title}} <b> & text'}));
    expect(getNotificationMessage({notificationType: 'ATTENDANCE_STATUS_CHANGED', message, templateVars: {attendanceStatus: 'PRESENT'}})).toContain(i18n.t('common:status.PRESENT'));
  });

  it('preserves legacy, unknown and incomplete notifications', () => {
    const cases: Parameters<typeof getNotificationMessage>[0][] = [
      {notificationType: 'ASSIGNMENT_PUBLISHED', templateVars: {}},
      {notificationType: 'UNKNOWN_TYPE', templateVars: {assignmentTitle: 'Title'}},
      {notificationType: 'ASSIGNMENT_PUBLISHED', templateVars: {courseTitle: 'Course'}},
      {notificationType: 'ASSIGNMENT_PUBLISHED', templateVars: {assignmentTitle: ''}},
      {notificationType: 'SESSION_CANCELLED', templateVars: {}},
      {notificationType: 'ASSIGNMENT_PUBLISHED'},
    ];
    for (const value of cases) expect(getNotificationMessage({...value, message})).toBe(message);
  });

  it.each(['TARGET', 'EXISTING_MEMBER', 'OLD_GROUP_MEMBER', 'NEW_GROUP_MEMBER'])('has a template or safe fallback for group audience %s', audienceVariant => {
    for (const notificationType of ['GROUP_MEMBER_ADDED', 'GROUP_MEMBER_REMOVED', 'GROUP_MEMBER_MOVED']) {
      const vars = {audienceVariant, groupName: 'Group', oldGroupName: 'Old group', newGroupName: 'New group', userName: 'Alex'};
      const result = getNotificationMessage({notificationType, message, templateVars: vars});
      const template = `notification:messages.${notificationType}_${audienceVariant}`;
      expect(result).toBe(i18n.exists(template) ? i18n.t(template, vars) : message);
      expect(result).not.toMatch(/{{/);
    }
  });

  it('does not let server variables override i18n options or hide a missing group template', async () => {
    await i18n.changeLanguage('zh-CN');
    expect(getNotificationMessage({notificationType: 'ASSIGNMENT_PUBLISHED', message, templateVars: {assignmentTitle: 'Essay', lng: 'en', defaultValue: 'Injected'}})).toBe('作业已发布：Essay');
    expect(getNotificationMessage({notificationType: 'GROUP_MEMBER_MOVED', message, templateVars: {audienceVariant: 'UNKNOWN'}})).toBe(message);
  });
});
