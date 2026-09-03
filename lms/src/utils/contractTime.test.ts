import {describe, expect, it} from 'vitest';
import {contractClock, contractTimeValue, formatZonedTimestamp} from './contractTime';

describe('contract time representations', () => {
  it('reads declared LocalTime objects and existing ISO time strings', () => {
    expect(contractClock({hour: 0, minute: 5, second: 0, nano: 0})).toBe('00:05');
    expect(contractClock('14:30:00')).toBe('14:30');
    expect(contractClock({hour: 25, minute: 0})).toBeUndefined();
    expect(contractClock('broken')).toBeUndefined();
    expect(contractTimeValue({hour: 9, minute: 0, second: 45, nano: 100000000})).toBe('09:00:45.1');
    expect(contractTimeValue('09:00:45')).toBe('09:00:45');
    expect(contractTimeValue({hour: 9, minute: 0, second: 60})).toBeUndefined();
  });

  it('renders the prior local calendar day for an evening class in Los Angeles', () => {
    expect(formatZonedTimestamp('2026-09-04T02:00:00Z', 'America/Los_Angeles')).toContain('Sep 3');
  });
});
