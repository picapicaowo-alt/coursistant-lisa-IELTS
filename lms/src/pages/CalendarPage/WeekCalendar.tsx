import {useLayoutEffect, useEffect, useState, useRef, type CSSProperties, type ReactNode} from 'react';
import {format} from 'date-fns';
import type {CalendarItem} from './calendarData';
import styles from './index.module.scss';
import {layoutDay, MINUTES_IN_DAY} from './weekLayout';
export function WeekCalendar({
  days,
  byDate,
  renderItem,
}: {
  days: Date[];
  byDate: Map<string, CalendarItem[]>;
  renderItem: (item: CalendarItem) => ReactNode;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer);}, []);
  const today = format(now, 'yyyy-MM-dd');
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const viewport = useRef<HTMLDivElement>(null);
  const hourRail = useRef<HTMLDivElement>(null);
  const dateKey = days.map(day => format(day, 'yyyy-MM-dd')).join(',');
  const entriesByDay = days.map(day => byDate.get(format(day, 'yyyy-MM-dd')) ?? []);
  const starts = entriesByDay.flatMap(entries => layoutDay(entries).map(entry => entry.start));
  const firstHour = starts.length ? Math.max(0, Math.floor(Math.min(...starts) / 60) - 1) : 8;
  const hasUntimed = entriesByDay.some(entries => entries.some(item => !item.startTime));

  // Start near the first event, keeping all 24 hours accessible by scrolling.
  // Eight o'clock is only the empty timetable's initial viewport, never a time constraint.
  useLayoutEffect(() => {
    if (viewport.current && hourRail.current) {
      viewport.current.scrollTop = firstHour * hourRail.current.getBoundingClientRect().height / 24;
    }
  }, [dateKey, firstHour]);

  return (
    <section
      className={styles.weekTimeGrid}
      aria-label={days.length === 1 ? 'Daily timetable' : 'Weekly timetable'}
      style={{'--day-count': days.length} as CSSProperties}
    >
      <div className={styles.timeHeading}>Time</div>
      {days.map((day) => (
        <header key={format(day, 'yyyy-MM-dd')} className={styles.timeDay} aria-current={format(day, 'yyyy-MM-dd') === today ? 'date' : undefined}>
          <span>{format(day, 'EEE')}</span>
          <strong>{format(day, 'd')}</strong>
        </header>
      ))}
      {hasUntimed ? <>
        <span className={styles.untimedLabel}>All day</span>
        {days.map((day, index) => <div key={format(day, 'yyyy-MM-dd')} className={styles.untimed}>
          {entriesByDay[index].filter(item => !item.startTime).map(item => <div key={item.id}>{renderItem(item)}</div>)}
        </div>)}
      </> : null}
      <div ref={viewport} className={styles.timetableViewport} tabIndex={0} aria-label="Scrollable 24-hour timetable">
      <div className={styles.hourRail} ref={hourRail}>
        {Array.from({length: 24}, (_, hour) => (
          <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
        ))}
      </div>
      {days.map((day) => {
        const date = format(day, 'yyyy-MM-dd');
        const entries = byDate.get(date) ?? [];
        return (
          <div
            className={styles.timeColumn}
            key={date}
            aria-label={format(day, 'EEEE MMMM d')}
          >
            {date === today ? <div className={styles.currentTime} style={{top: `${minutesNow / MINUTES_IN_DAY * 100}%`}} aria-label={`Current time ${format(now, 'HH:mm')}`}/> : null}
            {layoutDay(entries).map(({item, start, end, lane, lanes}) => (
              <div
                className={styles.timedEvent}
                key={item.id}
                style={
                  {
                    '--event-top': `${(start / MINUTES_IN_DAY) * 100}%`,
                    '--event-height': `${((end - start) / MINUTES_IN_DAY) * 100}%`,
                    '--event-left': `${(lane / lanes) * 100}%`,
                    '--event-width': `${100 / lanes}%`,
                  } as CSSProperties
                }
              >
                {renderItem(item)}
              </div>
            ))}
          </div>
        );
      })}
      </div>
    </section>
  );
}
