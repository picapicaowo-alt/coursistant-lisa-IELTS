import {useCallback, useEffect, useRef, useState} from 'react';
import type {InputHTMLAttributes} from 'react';
import {CalendarDays, Clock3} from 'lucide-react';
import {DateTimePickerPopover} from './DateTimePickerPopover';
import type {DateTimePickerKind} from './DateTimePickerPopover';
import styles from './EnglishDateInput.module.scss';

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string;
  onChangeValue: (value: string) => void;
};

const pad = (value: number) => String(value).padStart(2, '0');

const parseDate = (displayValue: string): string | null => {
  const trimmedValue = displayValue.trim();
  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return parseDate(`${month}/${day}/${year}`);
  }

  const match = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
};

const formatDate = (value: string): string => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : '';
};

const parseTime = (displayValue: string): string | null => {
  const trimmedValue = displayValue.trim();
  const twentyFourHourMatch = trimmedValue.match(/^(\d{2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    const hour = Number(twentyFourHourMatch[1]);
    const minute = Number(twentyFourHourMatch[2]);
    return hour <= 23 && minute <= 59 ? `${pad(hour)}:${pad(minute)}` : null;
  }

  const match = trimmedValue.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
  const period = match[3].toUpperCase();
  const hour24 = hour12 % 12 + (period === 'PM' ? 12 : 0);
  return `${pad(hour24)}:${pad(minute)}`;
};

const formatTime = (value: string): string => {
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return '';
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 > 23 || minute > 59) return '';
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${pad(hour12)}:${pad(minute)} ${period}`;
};

const formatDateTime = (dateTimeValue: string) => {
  const [date, time] = dateTimeValue.split('T');
  const formattedDate = formatDate(date ?? '');
  const formattedTime = formatTime(time ?? '');
  return formattedDate && formattedTime ? `${formattedDate}, ${formattedTime}` : '';
};

const parseDateTime = (displayValue: string) => {
  const trimmedValue = displayValue.trim();
  const isoMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  if (isoMatch) {
    const date = parseDate(isoMatch[1]);
    const time = parseTime(isoMatch[2]);
    return date && time ? `${date}T${time}` : null;
  }

  const match = trimmedValue.match(/^(.+?),\s*(.+)$/);
  if (!match) return null;
  const date = parseDate(match[1]);
  const time = parseTime(match[2]);
  return date && time ? `${date}T${time}` : null;
};

const useEnglishInput = (
  value: string,
  format: (value: string) => string,
  parse: (displayValue: string) => string | null,
  onChangeValue: (value: string) => void,
) => {
  const [displayValue, setDisplayValue] = useState(() => format(value));
  const lastEmittedValue = useRef(value);

  useEffect(() => {
    if (value === lastEmittedValue.current) return;
    lastEmittedValue.current = value;
    setDisplayValue(format(value));
  }, [format, value]);

  const onChange = (nextDisplayValue: string) => {
    const parsedValue = parse(nextDisplayValue);
    const nextValue = nextDisplayValue.trim() === '' ? '' : (parsedValue ?? '');
    setDisplayValue(parsedValue ? format(parsedValue) : nextDisplayValue);
    lastEmittedValue.current = nextValue;
    onChangeValue(nextValue);
  };

  return {displayValue, onChange};
};

const commonProps = {
  autoComplete: 'off',
  inputMode: 'numeric' as const,
  lang: 'en-US',
};

interface PickerInputProps extends BaseProps {
  kind: DateTimePickerKind;
  format: (value: string) => string;
  parse: (displayValue: string) => string | null;
  defaultPlaceholder: string;
  pattern: string;
  title: string;
}

const PickerInput = ({
  value,
  onChangeValue,
  kind,
  format,
  parse,
  defaultPlaceholder,
  pattern,
  title,
  onFocus,
  onClick,
  ...props
}: PickerInputProps) => {
  const input = useEnglishInput(value, format, parse, onChangeValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const pickerLabel = kind === 'date' ? 'Open calendar' : kind === 'time' ? 'Open time picker' : 'Open date and time picker';
  const PickerIcon = kind === 'time' ? Clock3 : CalendarDays;

  return (
    <span className={styles.field}>
      <input
        {...props}
        {...commonProps}
        ref={inputRef}
        type="text"
        value={input.displayValue}
        placeholder={props.placeholder ?? defaultPlaceholder}
        pattern={pattern}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        onInput={event => event.currentTarget.setCustomValidity('')}
        onInvalid={event => event.currentTarget.setCustomValidity(`${title}.`)}
        onChange={event => input.onChange(event.target.value)}
        onFocus={event => {
          onFocus?.(event);
        }}
        onClick={event => {
          setPickerOpen(true);
          onClick?.(event);
        }}
      />
      <span
        className={styles.trigger}
        role="button"
        tabIndex={props.disabled ? -1 : 0}
        aria-disabled={props.disabled}
        aria-label={pickerLabel}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        onClick={props.disabled ? undefined : () => {
          setPickerOpen(true);
          inputRef.current?.focus();
        }}
        onKeyDown={event => {
          if (props.disabled || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          setPickerOpen(true);
          inputRef.current?.focus();
        }}
      >
        <PickerIcon aria-hidden="true" size={17}/>
      </span>
      <DateTimePickerPopover
        anchorRef={inputRef}
        kind={kind}
        open={pickerOpen}
        value={value}
        onChangeValue={onChangeValue}
        onClose={closePicker}
      />
    </span>
  );
};

export const EnglishDateInput = ({value, onChangeValue, ...props}: BaseProps) => {
  return (
    <PickerInput
      {...props}
      kind="date"
      value={value}
      onChangeValue={onChangeValue}
      format={formatDate}
      parse={parseDate}
      defaultPlaceholder="MM/DD/YYYY"
      pattern="\d{1,2}/\d{1,2}/\d{4}"
      title="Use MM/DD/YYYY"
    />
  );
};

export const EnglishTimeInput = ({value, onChangeValue, ...props}: BaseProps) => {
  return (
    <PickerInput
      {...props}
      kind="time"
      value={value}
      onChangeValue={onChangeValue}
      format={formatTime}
      parse={parseTime}
      defaultPlaceholder="hh:mm AM/PM"
      pattern="\d{1,2}:\d{2}\s*(AM|PM|am|pm)"
      title="Use hh:mm AM/PM"
    />
  );
};

export const EnglishDateTimeInput = ({value, onChangeValue, ...props}: BaseProps) => {
  return (
    <PickerInput
      {...props}
      kind="datetime"
      value={value}
      onChangeValue={onChangeValue}
      format={formatDateTime}
      parse={parseDateTime}
      defaultPlaceholder="MM/DD/YYYY, hh:mm AM/PM"
      pattern="\d{1,2}/\d{1,2}/\d{4},\s*\d{1,2}:\d{2}\s*(AM|PM|am|pm)"
      title="Use MM/DD/YYYY, hh:mm AM/PM"
    />
  );
};
