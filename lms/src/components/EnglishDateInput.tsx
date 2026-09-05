import {useTranslation} from 'react-i18next';
import {getFormattingLocale} from '@/i18n/formatting';
import {formatInputDate as formatDate, formatInputTime as formatTime, formatInputDateTime as formatDateTime, parseInputDate as parseDate, parseInputTime as parseTime, parseInputDateTime as parseDateTime, inputPattern} from '@/i18n/dateInput';
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

const useLocalizedInput = (
  value: string,
  format: (value: string) => string,
  parse: (displayValue: string) => string | null,
  onChangeValue: (value: string) => void,
) => {
  const {i18n} = useTranslation();
  const previousLocale = useRef(i18n.language);
  const invalidDraft = useRef(false);
  const [displayValue, setDisplayValue] = useState(() => format(value));
  const lastEmittedValue = useRef(value);

  useEffect(() => {
    const changedLocale = previousLocale.current !== i18n.language;
    previousLocale.current = i18n.language;
    // Reformat valid values on locale changes, but never destroy a partially typed draft.
    if (value === lastEmittedValue.current && (!changedLocale || invalidDraft.current)) return;
    invalidDraft.current = false;
    lastEmittedValue.current = value;
    setDisplayValue(format(value));
  }, [format, value, i18n.language]);

  const onChange = (nextDisplayValue: string) => {
    const parsedValue = parse(nextDisplayValue);
    invalidDraft.current = parsedValue == null && nextDisplayValue.trim() !== '';
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
  const {t} = useTranslation('common');
  const input = useLocalizedInput(value, format, parse, onChangeValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const pickerLabel = t(kind === 'date' ? 'dateTime.openCalendar' : kind === 'time' ? 'dateTime.openTimePicker' : 'dateTime.openDateTimePicker');
  const PickerIcon = kind === 'time' ? Clock3 : CalendarDays;

  useEffect(() => {
    if (inputRef.current?.validity.customError) inputRef.current.setCustomValidity(title);
  }, [title]);

  return (
    <span className={styles.field}>
      <input
        {...props}
        {...commonProps}
        lang={getFormattingLocale()}
        ref={inputRef}
        type="text"
        value={input.displayValue}
        placeholder={props.placeholder ?? defaultPlaceholder}
        pattern={pattern}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        onInput={event => event.currentTarget.setCustomValidity('')}
        onInvalid={event => event.currentTarget.setCustomValidity(title)}
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

// Legacy export names are retained for callers; presentation follows the selected locale.
export const EnglishDateInput = ({value, onChangeValue, ...props}: BaseProps) => {
  const {t} = useTranslation('common');
  return (
    <PickerInput
      {...props}
      kind="date"
      value={value}
      onChangeValue={onChangeValue}
      format={formatDate}
      parse={parseDate}
      defaultPlaceholder={t('dateTime.input.datePlaceholder')}
      pattern={inputPattern('date')}
      title={t('dateTime.input.dateHint')}
    />
  );
};

// Legacy export names are retained for callers; presentation follows the selected locale.
export const EnglishTimeInput = ({value, onChangeValue, ...props}: BaseProps) => {
  const {t} = useTranslation('common');
  return (
    <PickerInput
      {...props}
      kind="time"
      value={value}
      onChangeValue={onChangeValue}
      format={formatTime}
      parse={parseTime}
      defaultPlaceholder={t('dateTime.input.timePlaceholder')}
      pattern={inputPattern('time')}
      title={t('dateTime.input.timeHint')}
    />
  );
};

// Legacy export names are retained for callers; presentation follows the selected locale.
export const EnglishDateTimeInput = ({value, onChangeValue, ...props}: BaseProps) => {
  const {t} = useTranslation('common');
  return (
    <PickerInput
      {...props}
      kind="datetime"
      value={value}
      onChangeValue={onChangeValue}
      format={formatDateTime}
      parse={parseDateTime}
      defaultPlaceholder={t('dateTime.input.dateTimePlaceholder')}
      pattern={inputPattern('datetime')}
      title={t('dateTime.input.dateTimeHint')}
    />
  );
};
