import {describe, expect, it} from 'vitest';
import {calendarDisplay} from './calendarDisplay';
import {calendarOccurrences} from '@/pages/CalendarPage/calendarOccurrences';

const session = {sourceId: 91, occurrenceId: 91, courseId: 37, startsAtUtc: '2026-09-10T18:00:00Z', endsAtUtc: '2026-09-10T19:00:00Z', timezone: 'America/Los_Angeles', date: '1999-01-01', startTime: '01:00'};
const courses = [{id: 37, courseCode: 'WR-101', title: 'Writing studio'}];

describe('calendar display timezone contract', () => {
  it('keeps the same source and UTC instant while switching LA and Shanghai display zones', () => {
    const la = calendarOccurrences({timezone: 'America/Los_Angeles', items: [session]}, courses, '2026-09-01', '2026-09-30').items[0];
    const sh = calendarOccurrences({timezone: 'Asia/Shanghai', items: [session]}, courses, '2026-09-01', '2026-09-30').items[0];
    expect(la).toMatchObject({sourceId: 91, startsAtUtc: session.startsAtUtc, date: '2026-09-10', startTime: '11:00', endTime: '12:00'});
    expect(sh).toMatchObject({sourceId: la.sourceId, startsAtUtc: la.startsAtUtc, date: '2026-09-11', startTime: '02:00', endTime: '03:00', timezone: 'Asia/Shanghai'});
    expect(session.startsAtUtc).toBe('2026-09-10T18:00:00Z');
  });

  it('uses display-zone dates for window inclusion and handles midnight and DST', () => {
    expect(calendarOccurrences({timezone: 'Asia/Shanghai', items: [session]}, courses, '2026-09-10', '2026-09-10').items).toEqual([]);
    expect(calendarDisplay({...session, startsAtUtc: '2026-09-10T16:00:00Z'}, 'Asia/Shanghai')).toMatchObject({date: '2026-09-11', startTime: '00:00'});
    expect(calendarDisplay({...session, startsAtUtc: '2026-03-08T09:30:00Z', endsAtUtc: '2026-03-08T10:30:00Z'}, 'America/Los_Angeles')).toMatchObject({startTime: '01:30', endTime: '03:30'});
  });

  it('never uses stale local fields or source timezone to rescue invalid UTC values', () => {
    expect(calendarDisplay({...session, startsAtUtc: 'invalid'}, 'Asia/Shanghai')).toBeUndefined();
    expect(calendarDisplay(session, 'Invalid/Timezone')).toBeUndefined();
    expect(calendarDisplay(session, undefined)).toBeUndefined();
  });
});
