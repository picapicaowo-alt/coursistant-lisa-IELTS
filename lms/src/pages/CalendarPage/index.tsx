import { useTranslation } from 'react-i18next';
import {useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, max, min, parseISO, startOfDay, endOfDay, startOfMonth, startOfWeek} from 'date-fns';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {Link} from 'react-router-dom';
import {formatClockTime, formatDateTime, formatDateRange, formatNumber, formatWeekday} from '@/i18n/formatting';
import {loadCalendarWindow, type CalendarItem} from './calendarData';
import {usePersonalEvents, type PersonalEventView} from './personalEvents';
import {useAnchoredEventDialog} from './useAnchoredEventDialog';
import {PersonalEventEditor} from './PersonalEventEditor';
import {WeekCalendar} from './WeekCalendar';
import styles from './index.module.scss';

type CalendarView = 'month' | 'week' | 'day';
type Category = 'all' | 'courses' | 'assignments' | 'personal';
const CATEGORIES = [{id: 'all', labelKey: 'calendar:categories.all'}, {id: 'courses', labelKey: 'common:fields.courses'}, {id: 'assignments', labelKey: 'course:detail.assignments'}, {id: 'personal', labelKey: 'calendar:categories.personal'}] as const;
const color = (item: CalendarItem) => item.kind === 'Personal' ? 'neutral' : item.kind === 'Assignment' || item.kind === 'Quiz' ? 'cyan' : item.kind === 'Event' ? 'pink' : 'brand';

const CalendarPage = ({embedded = false, courseId}: {embedded?: boolean; courseId?: number}) => {
  const { t: translate } = useTranslation();
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
  const canShowEmpty = calendar.isSuccess && personal.isSuccess && !calendar.data.failures.length && !personal.data.unavailableCount;
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
  const toggleCourse = (id: number) => setHiddenCourseIds(current => {const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;});
  const move = (direction: -1 | 1) => setCursor(current => view === 'month' ? addMonths(current, direction) : view === 'day' ? addDays(current, direction) : addWeeks(current, direction));
  const eventButton = (item: CalendarItem) => <button type="button" key={item.id} className={styles.calendarItem} data-color={color(item)} onClick={event => {eventAnchor.current = event.currentTarget; setSelected(item);}} title={`${item.title} · ${formatDateTime(parseISO(item.date), {dateStyle: 'medium'})} ${item.startTime ? formatClockTime(item.startTime) : translate('calendar:allDay')} · ${item.timezone}`}><strong>{item.title}</strong><span>{item.startTime ? formatClockTime(item.startTime) : translate('calendar:allDay')}{item.endTime ? ` – ${formatClockTime(item.endTime)}` : ''}</span></button>;
  return <main className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
    <h1 className={styles.visuallyHidden}>{translate("common:sidebar.calendar")}</h1>
    <nav className={styles.categoryTabs} aria-label={translate('calendar:categoriesLabel')}>{CATEGORIES.map(item => <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{translate(item.labelKey)}</button>)}</nav>
    <div className={styles.calendarShell}><div className={styles.calendarMain}>
      <header className={styles.toolbar}><div className={styles.navigation}><button type="button" onClick={() => move(-1)} aria-label={translate(`common:navigationControls.previousPeriod.${view}`)} title={translate(`common:navigationControls.previousPeriod.${view}`)}><ChevronLeft size={18} aria-hidden="true"/></button><h2>{view === 'month' ? formatDateTime(cursor, {year: 'numeric', month: 'long'}) : view === 'day' ? formatDateTime(cursor, {dateStyle: 'long'}) : formatDateRange(range.start, range.end, {year: 'numeric', month: 'short', day: 'numeric'})}</h2><button type="button" onClick={() => move(1)} aria-label={translate(`common:navigationControls.nextPeriod.${view}`)} title={translate(`common:navigationControls.nextPeriod.${view}`)}><ChevronRight size={18} aria-hidden="true"/></button></div><div className={styles.viewSwitch}><button type="button" onClick={() => setCursor(new Date())}>{translate("common:dateTime.today")}</button><label><span className={styles.visuallyHidden}>{translate('calendar:viewLabel')}</span><select value={view} onChange={event => setView(event.target.value as CalendarView)}><option value="day">{translate("course:scheduleModal.dayLabel")}</option><option value="week">{translate('calendar:views.week')}</option><option value="month">{translate('calendar:views.month')}</option></select></label><button type="button" className={styles.primary} disabled={!personal.isSuccess} onClick={event => {eventAnchor.current = event.currentTarget; setEditor({event: null});}}>{translate('calendar:addEvent')}</button></div></header>
      {calendar.isPending || personal.isPending ? <p className={styles.status} role="status">{translate('calendar:loading')}</p> : null}
      {calendar.isError ? <p className={styles.warning} role="alert">{translate('calendar:errors.courses')}{' '}<button type="button" onClick={() => void calendar.refetch()}>{translate('calendar:retryCourses')}</button></p> : null}
      {personal.isError ? <p className={styles.warning} role="alert">{translate('calendar:errors.personal')}{' '}<button type="button" onClick={() => void personal.refetch()}>{translate('calendar:retryPersonal')}</button></p> : null}
      {personal.data?.unavailableCount ? <p className={styles.warning} role="alert">{translate('calendar:errors.personalIncomplete', {count: personal.data.unavailableCount, number: formatNumber(personal.data.unavailableCount)})}</p> : null}
      {calendar.data?.failures.length ? <p className={styles.warning} role="alert">{calendar.data.failures.map(failure => translate(failure.translationKey, {courseCode: failure.courseCode, count: failure.count, number: formatNumber(failure.count ?? 0)})).join(' ')}{' '}<button type="button" onClick={() => void calendar.refetch()}>{translate("common:actions.retry")}</button></p> : null}
      {view !== 'month' ? <WeekCalendar days={days} byDate={byDate} renderItem={eventButton}/> : <section className={styles.monthGrid} aria-label={formatDateTime(cursor, {year: 'numeric', month: 'long'})}>
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(label => <div key={label} className={styles.weekday}>{formatWeekday(label)}</div>)}
        {days.map(day => {const date = format(day, 'yyyy-MM-dd'); return <article key={date} className={styles.dayCell} data-outside={!isSameMonth(day, cursor)}><time dateTime={date}>{formatNumber(day.getDate())}</time><div className={styles.dayItems}>{(byDate.get(date) ?? []).map(eventButton)}</div></article>;})}
      </section>}
      <section className={styles.mobileAgenda} aria-label={translate('calendar:dailyAgenda')}>{days.map(day => {const date = format(day, 'yyyy-MM-dd'); return <article key={date}><h3>{formatDateTime(day, {weekday: 'short', month: 'short', day: 'numeric'})}</h3>{(byDate.get(date) ?? []).length ? byDate.get(date)!.map(eventButton) : canShowEmpty ? <p>{translate('calendar:noEvents')}</p> : null}</article>;})}</section>
    </div><aside className={styles.eventRail}><h2>{translate('calendar:eventsInView')}</h2><p className={styles.timezone}>{translate('calendar:timezoneHelp')}</p>{visibleItems.length ? visibleItems.map(item => <div className={styles.railItem} key={item.id}>{eventButton(item)}<small>{formatDateTime(parseISO(item.date), {dateStyle: 'medium'})} · {item.timezone}</small></div>) : canShowEmpty ? <p className={styles.empty}>{translate('calendar:noEventsInView')}</p> : null}
      {calendar.data?.courses.length ? <fieldset className={styles.courseFilters}><legend>{translate("common:fields.courses")}</legend>{calendar.data.courses.map(course => <label key={course.id}><input type="checkbox" checked={!hiddenCourseIds.has(course.id)} onChange={() => toggleCourse(course.id)}/>{course.title || course.courseCode}</label>)}</fieldset> : null}
    </aside></div>
    {selected ? <EventDetails anchor={eventAnchor.current} item={selected} onClose={() => setSelected(undefined)} onEdit={() => {const event = personal.data?.items.find(event => event.id === selected.sourceId); if (event) {setEditor({event}); setSelected(undefined);}}}/> : null}
    {editor ? <PersonalEventEditor anchor={eventAnchor.current} selected={editor.event} onClose={() => setEditor(null)}/> : null}
  </main>;
};

function EventDetails({item, onClose, onEdit, anchor}: {anchor?: HTMLElement; item: CalendarItem; onClose: () => void; onEdit: () => void}) {
  const { t: translate } = useTranslation();
  const dialog = useAnchoredEventDialog(anchor);
  return <dialog ref={dialog} className={styles.eventDialog} aria-labelledby="event-details-title" onClose={onClose}><header><h2 id="event-details-title">{item.title}</h2><button type="button" aria-label={translate('calendar:details.close')} onClick={onClose}>×</button></header><dl className={styles.eventFacts}><div><dt>{translate("common:fields.date")}</dt><dd>{formatDateTime(parseISO(item.date), {dateStyle: 'medium'})}</dd></div><div><dt>{translate("common:dateTime.time")}</dt><dd>{item.startTime ? formatClockTime(item.startTime) : translate('calendar:allDay')}{item.endTime ? ` – ${formatClockTime(item.endTime)}` : ''} · {item.timezone}</dd></div>{item.courseTitle ? <div><dt>{translate("common:fields.course")}</dt><dd>{item.courseTitle}</dd></div> : null}{item.location ? <div><dt>{translate('calendar:details.location')}</dt><dd>{item.location}</dd></div> : null}<div><dt>{translate('calendar:details.category')}</dt><dd>{translate(`calendar:kinds.${item.kind}`)}</dd></div></dl><footer>{item.path ? <Link className={styles.primary} to={item.path}>{translate(`calendar:viewItem.${item.kind}`)}</Link> : null}{item.kind === 'Personal' ? <button type="button" className={styles.primary} onClick={onEdit}>{translate('calendar:editEvent')}</button> : null}<button type="button" onClick={onClose}>{translate("common:actions.close")}</button></footer></dialog>;
}
export default CalendarPage;
