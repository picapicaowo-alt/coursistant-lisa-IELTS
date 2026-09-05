import {useTranslation} from 'react-i18next';
import React, {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {useDashboardActivities, ACTIVITY_WINDOW_DAYS} from '@/pages/LmsHomePage/hooks/useDashboardActivities';
import './LearningScheduleComponent.scss';

const DATE_KEY = 'yyyy-MM-dd';

const LearningScheduleComponent: React.FC<{spacious?: boolean}> = ({spacious = false}) => {
  const {t: translate} = useTranslation();
  const {activities, isLoading, isError, refetch} = useDashboardActivities();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateSelected, setDateSelected] = useState(false);

  const activityDates = useMemo(() => new Set(activities.map(activity => activity.date)), [activities]);
  const upcoming = (dateSelected ? activities.filter(activity => activity.date === format(selectedDate, DATE_KEY)) : activities).slice(0, 3);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, {weekStartsOn: 1});
    const gridEnd = endOfWeek(endOfMonth(monthStart), {weekStartsOn: 1});
    const days: Date[] = [];
    for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) days.push(day);
    return days;
  }, [currentMonth]);

  return (
    <div className={`learning-schedule${spacious ? ' learning-schedule--spacious' : ''}`}>
      <header className="learning-schedule__header">
        <h2>Learning Schedule</h2>
        <Link to="/calendar" aria-label="Open full calendar">
          <img src="/icons/figma-dashboard/maximize.svg" alt=""/>
        </Link>
      </header>

      <div className="learning-schedule__calendar">
        <div className="learning-schedule__month">
          <button type="button" aria-label={translate('common:dateTime.previousMonth')} title={translate('common:dateTime.previousMonth')} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <img src="/icons/figma-dashboard/arrow-left.svg" alt=""/>
          </button>
          <strong>{format(currentMonth, 'MMMM yyyy')}</strong>
          <button type="button" aria-label={translate('common:dateTime.nextMonth')} title={translate('common:dateTime.nextMonth')} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <img src="/icons/figma-dashboard/arrow-right.svg" alt=""/>
          </button>
        </div>

        <div className="learning-schedule__weekdays" aria-hidden="true">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
        </div>

        <div className="learning-schedule__days">
          {calendarDays.map(day => {
            const dateKey = format(day, DATE_KEY);
            const selected = isSameDay(day, selectedDate);
            const outside = !isSameMonth(day, currentMonth);
            return (
              <button
                type="button"
                key={dateKey}
                className={selected ? 'is-selected' : undefined}
                data-outside={outside || undefined}
                data-has-activity={activityDates.has(dateKey) || undefined}
                onClick={() => {setSelectedDate(day); setDateSelected(true);}}
                aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                aria-pressed={selected}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>

      <div className="learning-schedule__timeline">
        {dateSelected ? <button className="learning-schedule__reset" type="button" onClick={() => setDateSelected(false)}>Show upcoming classes</button> : null}
        {isLoading ? <p className="learning-schedule__status">Loading schedule…</p> : null}
        {isError ? (
          <p className="learning-schedule__status" role="alert">
            Couldn&apos;t load your schedule. <button type="button" onClick={refetch}>Retry</button>
          </p>
        ) : null}
        {!isLoading && !isError && upcoming.length === 0 ? (
          <p className="learning-schedule__status">{dateSelected ? `No loaded sessions for ${format(selectedDate, 'MMM d')}. Open the full calendar to see other dates.` : `No sessions in the next ${ACTIVITY_WINDOW_DAYS} days.`}</p>
        ) : null}
        {!isLoading && !isError ? upcoming.map((activity, index) => (
          <Link
            to={`/course/${activity.courseId}`}
            className="learning-schedule__event"
            key={`${activity.source}-${activity.sourceId}-${activity.startTime}`}
            aria-label={`Open ${activity.courseCode}: ${activity.title}`}
          >
            <i data-muted={index === 2 || undefined}/>
            <span>
              <small>{isSameDay(new Date(`${activity.date}T00:00:00`), new Date()) ? 'Today' : format(new Date(`${activity.date}T00:00:00`), 'MMM d, EEE')}</small>
              <strong>{activity.title}</strong>
              <em>{activity.startTime.slice(0, 5)} - {activity.endTime.slice(0, 5)}</em>
            </span>
          </Link>
        )) : null}
      </div>
    </div>
  );
};

export default LearningScheduleComponent;
