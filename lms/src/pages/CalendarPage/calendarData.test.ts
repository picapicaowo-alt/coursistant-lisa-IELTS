import {describe, expect, it, vi} from 'vitest';
import {calendarOccurrences} from './calendarOccurrences';
import {layoutDay} from './weekLayout';
import {personalEventView} from './personalEvents';

const courses = [{id: 37, courseCode: 'WR-101', title: 'Writing studio'}];
const occurrence = {occurrenceId: 91, courseId: 37, occurrenceDate: '2026-09-10', startTime: '11:00:00', endTime: '12:00:00', timezone: 'America/Los_Angeles'};
vi.mock('@/apis/services/course-operations-api', () => ({courseOperationsApiService: {}}));

describe('dated calendar records', () => {
  it('uses returned occurrence dates instead of creating recurring class instances', () => {
    const result = calendarOccurrences([occurrence], courses, '2026-09-01', '2026-09-30');
    expect(result.items.map(item => item.date)).toEqual(['2026-09-10']);
    expect(result.items[0]).toMatchObject({kind: 'Session', startTime: '11:00', path: '/course/37/schedule'});
    expect(calendarOccurrences([occurrence], courses, '2026-09-11', '2026-09-30').items).toEqual([]);
  });
  it('renders UTC feed sessions in the requested calendar zone across a date boundary', () => {
    const result = calendarOccurrences({timezone: 'America/Los_Angeles', items: [{eventType: 'SESSION', occurrenceId: 91, courseId: 37, startsAtUtc: '2026-09-14T02:00:00Z', endsAtUtc: '2026-09-14T03:30:00Z', timezone: 'Asia/Singapore'}]}, courses, '2026-09-01', '2026-09-30');
    expect(result.unavailableCount).toBe(0);
    expect(result.items[0]).toMatchObject({date: '2026-09-13', startTime: '19:00', endTime: '20:30', timezone: 'America/Los_Angeles'});
  });
  it('reports incomplete occurrences without filling their missing dates or timezone', () => {
    const result = calendarOccurrences([{...occurrence, timezone: null}, {...occurrence, occurrenceDate: undefined}], courses, '2026-09-01', '2026-09-30');
    expect(result).toEqual({items: [], unavailableCount: 2});
  });
  it('keeps overlapping events in separate lanes and reuses space after the overlap ends', () => {
    const base = calendarOccurrences([occurrence], courses, '2026-09-01', '2026-09-30').items[0];
    const rows = layoutDay([base, {...base, id: 'second', startTime: '11:30', endTime: '12:30'}, {...base, id: 'third', startTime: '12:30', endTime: '13:00'}]);
    expect(rows.map(row => [row.lane, row.lanes])).toEqual([[0, 2], [1, 2], [0, 1]]);
  });
  it('never manufactures a version when a personal event read omits it', () => {
    const event = {id: 5, title: 'Practice', startsAtLocal: '2026-09-10T11:00:00', endsAtLocal: '2026-09-10T12:00:00', timezone: 'America/Los_Angeles'};
    expect(personalEventView(event)?.version).toBeUndefined();
    expect(personalEventView({...event, version: 4})?.version).toBe(4);
    expect(personalEventView({...event, id: -1})).toBeUndefined();
  });
});
