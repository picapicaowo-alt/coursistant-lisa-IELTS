import {describe, expect, it} from 'vitest';
import {parseAttendance, parseOccurrence, parsePost, parseReport, recordPage, timeRange} from './records';

describe('Instructor teaching records', () => {
  it('distinguishes malformed responses from empty lists', () => {
    expect(recordPage({items: [], total: 0})).toEqual({items: [], total: 0});
    expect(() => recordPage({message: 'Unavailable'})).toThrow('supported list');
    expect(() => recordPage([null])).toThrow('unsupported record');
  });
  it('never substitutes a report or attendance row ID for a student identity', () => {
    expect(() => parseReport({id: 9, reportType: 'FINAL'})).toThrow('identity');
    expect(() => parseAttendance({version: 1, entries: [{id: 9, status: 'PRESENT'}]})).toThrow('identity');
  });
  it('preserves unrecorded attendance and optimistic version zero', () => {
    const roster = parseAttendance({attendanceVersion: 0, entries: [{studentUserId: 8, studentFirstName: '周', studentLastName: '明'}]});
    expect(roster.version).toBe(0);
    expect(roster.items[0].status).toBeUndefined();
    expect(roster.items[0].name).toBe('周 明');
  });
  it('rejects duplicate students before a write can be offered', () => {
    expect(() => parseAttendance({entries: [{studentUserId: 8}, {studentUserId: 8}]})).toThrow('duplicate');
  });
  it('does not fabricate report narratives or unsafe versions', () => {
    const report = parseReport({id: 1, studentUserId: 8, version: '1', status: 'PUBLISHED'});
    expect(report.version).toBeUndefined();
    expect(report.overallSummary).toBeUndefined();
    expect(report.status).toBe('PUBLISHED');
  });
  it('requires a dated occurrence and preserves attendance lock state', () => {
    expect(() => parseOccurrence({id: 1})).toThrow('date');
    expect(parseOccurrence({id: 1, occurrenceDate: '2026-09-03', attendanceOpened: true, version: 0})).toMatchObject({attendanceOpened: true, version: 0});
    expect(timeRange('10:00:00', '11:30:00')).toBe('10:00 AM – 11:30 AM');
  });
  it('uses the real discussion body rather than inventing a title or count', () => {
    expect(parsePost({id: 1, body: 'A question\nMore context', authorFirstName: 'Alex', authorLastName: 'Chen'})).toMatchObject({body: 'A question\nMore context', name: 'Alex Chen'});
  });
});
