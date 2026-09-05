import {describe, expect, it, vi} from 'vitest';
import {formatUtcTimestamp, parseUtcTimestamp, parseZonedTimestamp} from './datetime';

describe('course activity timestamps', () => {
  it('anchors a zone-less activity in its supplied course zone', () => {
    expect(parseZonedTimestamp('2026-09-05T15:36:24', 'Asia/Shanghai').toISOString()).toBe('2026-09-05T07:36:24.000Z');
    expect(parseZonedTimestamp('2026-09-05T00:36:24', 'America/Los_Angeles').toISOString()).toBe('2026-09-05T07:36:24.000Z');
  });

  it('preserves explicit offsets instead of applying the course zone again', () => {
    expect(parseZonedTimestamp('2026-09-05T07:36:24Z', 'Asia/Shanghai').toISOString()).toBe('2026-09-05T07:36:24.000Z');
    expect(parseZonedTimestamp('2026-09-05T00:36:24-07:00', 'Asia/Shanghai').toISOString()).toBe('2026-09-05T07:36:24.000Z');
  });

  it('does not crash the activity list or invent an instant for invalid input', () => {
    expect(Number.isNaN(parseZonedTimestamp('invalid', 'Asia/Shanghai').getTime())).toBe(true);
    expect(Number.isNaN(parseZonedTimestamp('2026-09-05T15:36:24', 'invalid').getTime())).toBe(true);
  });
});

describe('UTC timestamp display', () => {
  it('treats a zone-less backend LocalDateTime as UTC', () => {
    expect(parseUtcTimestamp('2026-08-24T04:47:21').toISOString()).toBe('2026-08-24T04:47:21.000Z');
    expect(parseUtcTimestamp('2026-08-24 04:47:21').toISOString()).toBe('2026-08-24T04:47:21.000Z');
  });

  it('does not alter an instant that already has a timezone', () => {
    expect(parseUtcTimestamp('2026-08-24T04:47:21Z').toISOString()).toBe('2026-08-24T04:47:21.000Z');
    expect(parseUtcTimestamp('2026-08-23T21:47:21-07:00').toISOString()).toBe('2026-08-24T04:47:21.000Z');
  });

  it('formats normalized UTC in the viewer timezone with a zone label', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(formatUtcTimestamp('2026-08-24T04:47:21')).toContain('Aug 23, 2026');
    expect(formatUtcTimestamp('2026-08-24T04:47:21')).toMatch(/PDT|GMT-7/);
    vi.unstubAllEnvs();
  });
});
