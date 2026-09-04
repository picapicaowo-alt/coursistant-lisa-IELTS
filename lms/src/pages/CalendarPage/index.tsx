import {useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, max, min, parseISO, startOfDay, endOfDay, startOfMonth, startOfWeek} from 'date-fns';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {Link} from 'react-router-dom';
import {loadCalendarWindow, type CalendarItem} from './calendarData';
import {usePersonalEvents, type PersonalEventView} from './personalEvents';
import {useAnchoredEventDialog} from './useAnchoredEventDialog';
import {PersonalEventEditor} from './PersonalEventEditor';
import {WeekCalendar} from './WeekCalendar';
import styles from './index.module.scss';

type CalendarView = 'month' | 'week' | 'day';
type Category = 'all' | 'courses' | 'assignments' | 'personal';
const CATEGORIES = [{id: 'all', label: 'All Events'}, {id: 'courses', label: 'Courses'}, {id: 'assignments', label: 'Assignments'}, {id: 'personal', label: 'Personal'}] as const;
const color = (item: CalendarItem) => item.kind === 'Personal' ? 'neutral' : item.kind === 'Assignment' || item.kind === 'Quiz' ? 'cyan' : item.kind === 'Event' ? 'pink' : 'brand';

const CalendarPage = ({embedded = false, courseId}: {embedded?: boolean; courseId?: number}) => {
  const eventAnchor = useRef<HTMLElement>();
  const [view, setView] = useState<CalendarView>('week');
  const [category, setCategory] = useState<Category>('all');
  const [cursor, setCursor] = useState(() => new Date());
  const [editor, setEditor] = useState<{event: PersonalEventView | null} | null>(null);
  const [selected, setSelected] = useState<CalendarItem>();
  const [hiddenCourseIds, setHiddenCourseIds] = useState<Set<number>>(() => new Set());
  const range = useMemo(() => {
    const start = view === 'day' ? startOfDay(cursor) : startOfWeek(view === 'month' ? startOfMonth(cursor) : cursor, {weekStartsOn: 1});
    const end = view === 'day' ? endOfDay(cursor) : endOfWeek(view === 'month' ? endOfMonth(cursor) : cursor, {weekStartsOn: 1});
    return {start, end, startKey: format(start, 'yyyy-MM-dd'), endKey: format(end, 'yyyy-MM-dd'), fromUtc: start.toISOString(), toUtc: addDays(new Date(end.getFullYear(), end.getMonth(), end.getDate()), 1).toISOString()};
  }, [cursor, view]);
  const calendar = useQuery({queryKey: ['calendar', range.startKey, range.endKey], queryFn: () => loadCalendarWindow(range.startKey, range.endKey), retry: false});
  const personal = usePersonalEvents(range.fromUtc, range.toUtc);
  const days = useMemo(() => eachDayOfInterval({start: range.start, end: range.end}), [range.end, range.start]);
  const personalItems = useMemo<CalendarItem[]>(() => (personal.data?.items ?? []).flatMap(event => {
    const start = max([parseISO(event.startsAtLocal.slice(0, 10)), range.start]);
    // The end is exclusive: midnight belongs to the preceding event day.
    const endDate = parseISO(event.endsAtLocal.slice(0, 10));
    const lastDay = event.endsAtLocal.slice(11, 19) === '00:00:00' || event.endsAtLocal.slice(11) === '00:00' ? addDays(endDate, -1) : endDate;
    const end = min([lastDay, range.end]);
    if (start > end || !Number.isFinite(+start) || !Number.isFinite(+end)) return [];
    return eachDayOfInterval({start, end}).map(day => {
      const date = format(day, 'yyyy-MM-dd');
      return {id: `personal-${event.id}-${date}`, sourceId: event.id, courseCode: '', courseTitle: '', title: event.title, kind: 'Personal' as const, date, startTime: date === event.startsAtLocal.slice(0, 10) ? event.startsAtLocal.slice(11, 16) : '00:00', endTime: date === event.endsAtLocal.slice(0, 10) ? event.endsAtLocal.slice(11, 16) : '23:59', timezone: event.timezone, location: null};
    });
  }), [personal.data?.items, range.end, range.start]);
  const visibleItems = useMemo(() => [...(calendar.data?.items ?? []), ...personalItems].filter(item =>
    (!courseId || item.courseId === courseId || item.kind === 'Personal') && (item.courseId == null || !hiddenCourseIds.has(item.courseId)) && (category === 'all' || category === 'personal' && item.kind === 'Personal' || category === 'assignments' && (item.kind === 'Assignment' || item.kind === 'Quiz') || category === 'courses' && (item.kind === 'Session' || item.kind === 'Event')),
  ).sort((a, b) => `${a.date}${a.startTime ?? ''}`.localeCompare(`${b.date}${b.startTime ?? ''}`)), [calendar.data?.items, personalItems, hiddenCourseIds, category, courseId]);
  const byDate = useMemo(() => {const grouped = new Map<string, CalendarItem[]>(); visibleItems.forEach(item => grouped.set(item.date, [...grouped.get(item.date) ?? [], item])); return grouped;}, [visibleItems]);
  // An unavailable source is not proof that the selected dates have no events.
  const canShowEmptyState = calendar.isSuccess && personal.isSuccess && !calendar.data.failures.length && !personal.data.unavailableCount;
  const toggleCourse = (id: number) => setHiddenCourseIds(current => {const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;});
  const move = (direction: -1 | 1) => setCursor(current => view === 'month' ? addMonths(current, direction) : view === 'day' ? addDays(current, direction) : addWeeks(current, direction));
  const eventButton = (item: CalendarItem) => <button type="button" key={item.id} className={styles.calendarItem} data-color={color(item)} onClick={event => {eventAnchor.current = event.currentTarget; setSelected(item);}} title={`${item.title} · ${item.date} ${item.startTime ?? ''} · ${item.timezone}`}><strong>{item.title}</strong><span>{item.startTime ?? 'All day'}{item.endTime ? ` – ${item.endTime}` : ''}</span></button>;
  return <main className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
    <h1 className={styles.visuallyHidden}>Calendar</h1>
    <nav className={styles.categoryTabs} aria-label="Calendar categories">{CATEGORIES.map(item => <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}</nav>
    <div className={styles.calendarShell}><div className={styles.calendarMain}>
      <header className={styles.toolbar}><div className={styles.navigation}><button type="button" onClick={() => move(-1)} aria-label={`Previous ${view}`}><ChevronLeft size={18}/></button><h2>{view === 'month' ? format(cursor, 'MMMM yyyy') : view === 'day' ? format(cursor, 'MMMM d, yyyy') : `${format(range.start, 'MMM d')} – ${format(range.end, 'MMM d, yyyy')}`}</h2><button type="button" onClick={() => move(1)} aria-label={`Next ${view}`}><ChevronRight size={18}/></button></div><div className={styles.viewSwitch}><button type="button" onClick={() => setCursor(new Date())}>Today</button><label><span className={styles.visuallyHidden}>Calendar view</span><select value={view} onChange={event => setView(event.target.value as CalendarView)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label><button type="button" className={styles.primary} onClick={event => {eventAnchor.current = event.currentTarget; setEditor({event: null});}}>+ Add event</button></div></header>
      {calendar.isPending || personal.isPending ? <p className={styles.status} role="status">Loading calendar…</p> : null}
      {calendar.isError ? <p className={styles.warning} role="alert">Course calendar could not be loaded. <button type="button" onClick={() => void calendar.refetch()}>Retry courses</button></p> : null}
      {personal.isError ? <p className={styles.warning} role="alert">Personal events could not be loaded. <button type="button" onClick={() => void personal.refetch()}>Retry personal events</button></p> : null}
      {personal.data?.unavailableCount ? <p className={styles.warning} role="alert">{personal.data.unavailableCount} personal events lack the details required to display them.</p> : null}
      {calendar.data?.failures.length ? <p className={styles.warning} role="alert">{calendar.data.failures.join('. ')}. <button type="button" onClick={() => void calendar.refetch()}>Retry</button></p> : null}
      {view !== 'month' ? <WeekCalendar days={days} byDate={byDate} renderItem={eventButton}/> : <section className={styles.monthGrid} aria-label={format(cursor, 'MMMM yyyy')}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(label => <div key={label} className={styles.weekday}>{label}</div>)}
        {days.map(day => {const date = format(day, 'yyyy-MM-dd'); return <article key={date} className={styles.dayCell} data-outside={!isSameMonth(day, cursor)}><time dateTime={date}>{format(day, 'd')}</time><div className={styles.dayItems}>{(byDate.get(date) ?? []).map(eventButton)}</div></article>;})}
      </section>}
      <section className={styles.mobileAgenda} aria-label="Daily agenda">{days.map(day => {const date = format(day, 'yyyy-MM-dd'); return <article key={date}><h3>{format(day, 'EEE, MMM d')}</h3>{(byDate.get(date) ?? []).length ? byDate.get(date)!.map(eventButton) : canShowEmptyState ? <p>No events</p> : null}</article>;})}</section>
    </div><aside className={styles.eventRail}><h2>Events in view</h2><p className={styles.timezone}>Times shown in each event’s timezone.</p>{visibleItems.length ? visibleItems.map(item => <div className={styles.railItem} key={item.id}>{eventButton(item)}<small>{item.date} · {item.timezone}</small></div>) : canShowEmptyState ? <p className={styles.empty}>No events in this view.</p> : null}
      {calendar.data?.courses.length ? <fieldset className={styles.courseFilters}><legend>Courses</legend>{calendar.data.courses.map(course => <label key={course.id}><input type="checkbox" checked={!hiddenCourseIds.has(course.id)} onChange={() => toggleCourse(course.id)}/>{course.title || course.courseCode}</label>)}</fieldset> : null}
    </aside></div>
    {selected ? <EventDetails anchor={eventAnchor.current} item={selected} onClose={() => setSelected(undefined)} onEdit={() => {const event = personal.data?.items.find(event => event.id === selected.sourceId); if (event) {setEditor({event}); setSelected(undefined);}}}/> : null}
    {editor ? <PersonalEventEditor anchor={eventAnchor.current} selected={editor.event} onClose={() => setEditor(null)}/> : null}
  </main>;
};

function EventDetails({item, onClose, onEdit, anchor}: {anchor?: HTMLElement; item: CalendarItem; onClose: () => void; onEdit: () => void}) {
  const dialog = useAnchoredEventDialog(anchor);
  return <dialog ref={dialog} className={styles.eventDialog} aria-labelledby="event-details-title" onClose={onClose}><header><h2 id="event-details-title">{item.title}</h2><button type="button" aria-label="Close event details" onClick={onClose}>×</button></header><dl className={styles.eventFacts}><div><dt>Date</dt><dd>{item.date}</dd></div><div><dt>Time</dt><dd>{item.startTime ?? 'All day'}{item.endTime ? ` – ${item.endTime}` : ''} · {item.timezone}</dd></div>{item.courseTitle ? <div><dt>Course</dt><dd>{item.courseTitle}</dd></div> : null}{item.location ? <div><dt>Location</dt><dd>{item.location}</dd></div> : null}<div><dt>Category</dt><dd>{item.kind}</dd></div></dl><footer>{item.path ? <Link className={styles.primary} to={item.path}>View {item.kind.toLowerCase()}</Link> : null}{item.kind === 'Personal' ? <button type="button" className={styles.primary} onClick={onEdit}>Edit event</button> : null}<button type="button" onClick={onClose}>Close</button></footer></dialog>;
}
export default CalendarPage;
