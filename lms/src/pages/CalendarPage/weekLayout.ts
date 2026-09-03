import type {CalendarItem} from './calendarData';
export const MINUTES_IN_DAY = 24 * 60;
const minutes = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
/** Allocate an independent lane for concurrent events so one entry never hides another. */
export function layoutDay(items: CalendarItem[]) {
  const sorted = items
    .filter((item) => item.startTime)
    .map((item) => {
      const start = minutes(item.startTime!);
      const end = item.endTime ? minutes(item.endTime) : start + 30;
      return {
        item,
        start,
        end: Math.min(MINUTES_IN_DAY, Math.max(start + 30, end)),
        lane: 0,
        lanes: 1,
      };
    })
    .filter(
      (item) =>
        Number.isFinite(item.start) &&
        item.start >= 0 &&
        item.start < MINUTES_IN_DAY,
    )
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let group: typeof sorted = [];
  let groupEnd = 0;
  const finish = () => {
    const lanes = Math.max(1, ...group.map((event) => event.lane + 1));
    group.forEach((event) => {
      event.lanes = lanes;
    });
  };
  for (const event of sorted) {
    if (event.start >= groupEnd) {
      finish();
      group = [];
      groupEnd = 0;
    }
    const occupied = new Set(
      group
        .filter((previous) => previous.end > event.start)
        .map((previous) => previous.lane),
    );
    while (occupied.has(event.lane)) event.lane++;
    group.push(event);
    groupEnd = Math.max(groupEnd, event.end);
  }
  finish();
  return sorted;
}
