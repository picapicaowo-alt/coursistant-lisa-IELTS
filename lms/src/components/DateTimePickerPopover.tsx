import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {RefObject} from 'react';
import {createPortal} from 'react-dom';
import {CalendarDays, ChevronLeft, ChevronRight, Clock3} from 'lucide-react';
import {roundUpToMinutes} from '@/utils/dateTimeRange';
import {datePopoverPosition} from './datePopoverPosition';
import styles from './DateTimePickerPopover.module.scss';

export type DateTimePickerKind = 'date' | 'time' | 'datetime';

interface DateTimePickerPopoverProps {
  anchorRef: RefObject<HTMLInputElement>;
  kind: DateTimePickerKind;
  open: boolean;
  value: string;
  onChangeValue: (value: string) => void;
  onClose: () => void;
}

interface CalendarDay {
  date: Date;
  key: string;
  isOutsideMonth: boolean;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({length: 12}, (_, index) => String(index + 1));
const MINUTES = Array.from({length: 60}, (_, index) => String(index).padStart(2, '0'));

const pad = (value: number) => String(value).padStart(2, '0');

const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const isDateKey = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day;
};

const dateFromKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const timeParts = (value: string, fallback: Date) => {
  const match = value.match(/^(\d{2}):(\d{2})/);
  const hour24 = match ? Number(match[1]) : fallback.getHours();
  const minute = match ? Number(match[2]) : fallback.getMinutes();
  return {
    hour: String(hour24 % 12 || 12),
    minute: pad(minute),
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
};

const toTimeValue = (hour: string, minute: string, period: string) => {
  const hour12 = Number(hour);
  const hour24 = hour12 % 12 + (period === 'PM' ? 12 : 0);
  return `${pad(hour24)}:${minute}`;
};

const calendarDays = (month: Date): CalendarDay[] => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());

  return Array.from({length: 42}, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      key: toDateKey(date),
      isOutsideMonth: date.getMonth() !== month.getMonth(),
    };
  });
};

export const DateTimePickerPopover = ({
  anchorRef,
  kind,
  open,
  value,
  onChangeValue,
  onClose,
}: DateTimePickerPopoverProps) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [hour, setHour] = useState('12');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState('PM');
  const [position, setPosition] = useState({left: 0, top: 0, maxHeight: 0, ready: false});
  const showCalendar = kind !== 'time';
  const showTime = kind !== 'date';
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const todayKey = toDateKey(new Date());

  useEffect(() => {
    if (!open) return;
    const now = roundUpToMinutes(new Date());
    const rawDate = kind === 'datetime' ? value.split('T')[0] : value;
    const nextDate = isDateKey(rawDate) ? rawDate : toDateKey(now);
    const rawTime = kind === 'datetime' ? (value.split('T')[1] ?? '') : value;
    const nextTime = timeParts(rawTime, now);

    setSelectedDate(nextDate);
    setVisibleMonth(new Date(dateFromKey(nextDate).getFullYear(), dateFromKey(nextDate).getMonth(), 1));
    setHour(nextTime.hour);
    setMinute(nextTime.minute);
    setPeriod(nextTime.period);
  }, [kind, open, value]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        anchorRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;
      const anchorRect = anchor.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      const viewport = {left: visualViewport?.offsetLeft ?? 0, top: visualViewport?.offsetTop ?? 0, right: (visualViewport?.offsetLeft ?? 0) + (visualViewport?.width ?? window.innerWidth), bottom: (visualViewport?.offsetTop ?? 0) + (visualViewport?.height ?? window.innerHeight)};
      if (!anchorRect.height || anchorRect.bottom < viewport.top || anchorRect.top > viewport.bottom) { onClose(); return; }
      const next = datePopoverPosition(anchorRect, {width: popover.offsetWidth, height: popover.scrollHeight + popover.offsetHeight - popover.clientHeight}, viewport);
      setPosition(current => current.ready && current.left === next.left && current.top === next.top && current.maxHeight === next.maxHeight ? current : {...next, ready: true});
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, {capture: true, passive: true});
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    const observer = new ResizeObserver(updatePosition);
    if (popoverRef.current) observer.observe(popoverRef.current);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
      observer.disconnect();
    };
  }, [anchorRef, kind, onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  const dismiss = () => {
    onClose();
    anchorRef.current?.focus();
  };

  const selectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    if (kind === 'date') {
      onChangeValue(dateKey);
      dismiss();
    }
  };

  const setNow = () => {
    const now = new Date();
    const date = toDateKey(now);
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    onChangeValue(kind === 'date' ? date : kind === 'time' ? time : `${date}T${time}`);
    dismiss();
  };

  const apply = () => {
    const time = toTimeValue(hour, minute, period);
    onChangeValue(kind === 'time' ? time : `${selectedDate}T${time}`);
    dismiss();
  };

  const clear = () => {
    onChangeValue('');
    dismiss();
  };

  const title = kind === 'date' ? 'Select date' : kind === 'time' ? 'Select time' : 'Select date & time';

  return createPortal(
    <div
      ref={popoverRef}
      className={styles.popover}
      role="dialog"
      aria-label={title}
      style={{left: position.left, top: position.top, maxHeight: position.ready ? position.maxHeight : undefined, visibility: position.ready ? 'visible' : 'hidden'}}
    >
      <div className={styles.titleRow}>
        <span className={styles.titleIcon}>{showCalendar ? <CalendarDays size={18}/> : <Clock3 size={18}/>}</span>
        <strong>{title}</strong>
      </div>

      {showCalendar ? (
        <div className={styles.calendar}>
          <div className={styles.monthNavigation}>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              <ChevronLeft size={18}/>
            </button>
            <strong aria-live="polite">{MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              <ChevronRight size={18}/>
            </button>
          </div>
          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAYS.map(day => <span key={day}>{day}</span>)}
          </div>
          <div className={styles.days}>
            {days.map(day => (
              <button
                type="button"
                key={day.key}
                className={day.key === selectedDate ? styles.selectedDay : undefined}
                data-outside-month={day.isOutsideMonth || undefined}
                aria-label={day.date.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'})}
                aria-pressed={day.key === selectedDate}
                aria-current={day.key === todayKey ? 'date' : undefined}
                onClick={() => selectDate(day.key)}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showTime ? (
        <fieldset className={styles.timePicker}>
          <legend>Time</legend>
          <label>
            <span>Hour</span>
            <select aria-label="Hour" value={hour} onChange={event => setHour(event.target.value)}>
              {HOURS.map(option => <option key={option} value={option}>{pad(Number(option))}</option>)}
            </select>
          </label>
          <span className={styles.timeSeparator} aria-hidden="true">:</span>
          <label>
            <span>Minute</span>
            <select aria-label="Minute" value={minute} onChange={event => setMinute(event.target.value)}>
              {MINUTES.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>AM or PM</span>
            <select aria-label="AM or PM" value={period} onChange={event => setPeriod(event.target.value)}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </label>
        </fieldset>
      ) : null}

      <div className={styles.footer}>
        <div className={styles.shortcuts}>
          <button type="button" className={styles.textButton} onClick={setNow}>{kind === 'date' ? 'Today' : 'Now'}</button>
          {value ? <button type="button" className={styles.textButton} onClick={clear}>Clear</button> : null}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={dismiss}>Cancel</button>
          {showTime ? <button type="button" className={styles.applyButton} onClick={apply}>{kind === 'time' ? 'Set time' : 'Set date & time'}</button> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
};
