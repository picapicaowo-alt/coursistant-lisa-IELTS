import {describe, expect, it} from 'vitest';
import {getParentArea, getParentSection, parentHref} from './parentNavigation';

describe('Parent navigation', () => {
  it('preserves existing section links and rejects unknown or prototype keys', () => {
    expect(getParentSection(new URLSearchParams('section=notifications'))).toBe('notifications');
    expect(getParentArea('notifications')).toBe('messages');
    for (const section of ['unknown', 'constructor', '__proto__']) expect(getParentSection(new URLSearchParams({section}))).toBe('dashboard');
  });
  it('keeps student context but resets unrelated subviews between areas', () => {
    expect(parentHref('schedule', new URLSearchParams('studentUserId=302&tab=attendance&section=learning'))).toBe('/parent?section=schedule&studentUserId=302');
    expect(parentHref('learning', new URLSearchParams('studentUserId=302'), 'courses')).toBe('/parent?section=learning&studentUserId=302&tab=courses');
  });
});
