import { useTranslation } from 'react-i18next';
import {durationLabel} from '@/utils/dateTimeRange';

interface DurationSelectProps {
  minutes: number | null;
  options: readonly number[];
  onChange: (minutes: number) => void;
  disabled?: boolean;
}

export const DurationSelect = ({minutes, options, onChange, disabled = false}: DurationSelectProps) => {
  const { t: translate } = useTranslation();
  return (
  <label>
    <span>{translate("common:fields.duration")}</span>
    <select
      aria-label={translate("common:fields.duration")}
      disabled={disabled}
      value={minutes === null ? 'custom' : String(minutes)}
      onChange={event => {
        if (event.target.value !== 'custom') onChange(Number(event.target.value));
      }}
    >
      {options.map(option => (
        <option key={option} value={option}>{durationLabel(option)}</option>
      ))}
      {minutes === null ? <option value="custom">{translate(disabled ? 'common:dateTime.setStartFirst' : 'common:dateTime.customDuration')}</option> : null}
    </select>
  </label>
);
};
