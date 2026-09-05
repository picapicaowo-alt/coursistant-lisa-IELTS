import { useTranslation } from "react-i18next";
import {
  SYSTEM_MANAGED_LEVEL_OPTIONS,
  type ManagedLevel,
} from "../managedUserOptions";

export function LevelSelect({
  value,
  onChange,
  options = SYSTEM_MANAGED_LEVEL_OPTIONS,
}: {
  value: ManagedLevel;
  onChange: (level: ManagedLevel) => void;
  options?: ManagedLevel[];
}) {
  const { t } = useTranslation();
  return (
    <label>
      <span>{t("common:admin.identity")}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as ManagedLevel)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {t(`common:roles.${option}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
