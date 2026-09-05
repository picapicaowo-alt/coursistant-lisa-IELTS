import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/formatting";
import { ChevronDown } from "lucide-react";
import styles from "./index.module.scss";
import {
  ASSIGNMENT_FILE_TYPE_OPTIONS,
  type FileTypeOption,
} from "./assignmentFileTypes";

const normalizeExtensions = (extensions: string[]) =>
  Array.from(
    new Set(
      extensions
        .map((extension) => extension.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean),
    ),
  );

interface FileTypeMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export const FileTypeMultiSelect = ({
  value,
  onChange,
}: FileTypeMultiSelectProps) => {
  const { t: translate } = useTranslation();
  const normalized = normalizeExtensions(value);
  const knownExtensions = new Set(
    ASSIGNMENT_FILE_TYPE_OPTIONS.map((option) => option.extension),
  );
  const retainedOptions: FileTypeOption[] = normalized
    .filter((extension) => !knownExtensions.has(extension))
    .map((extension) => ({
      extension,
      labelKey: "assessment:files.configured",
      groupKey: "assessment:files.groups.other",
    }));
  const options = [...ASSIGNMENT_FILE_TYPE_OPTIONS, ...retainedOptions];
  const allExtensions = options.map((option) => option.extension);
  const selected = new Set(normalized);
  const groups = Array.from(new Set(options.map((option) => option.groupKey)));

  const toggle = (extension: string) => {
    const next = new Set(selected);
    if (next.has(extension)) next.delete(extension);
    else next.add(extension);
    onChange(allExtensions.filter((option) => next.has(option)));
  };

  const summary =
    normalized.length === 0
      ? translate("assessment:files.select")
      : normalized.length === allExtensions.length
        ? translate("assessment:files.all", {
            number: formatNumber(allExtensions.length),
          })
        : normalized.length <= 4
          ? normalized.map((extension) => `.${extension}`).join(", ")
          : translate("assessment:files.selected", {
              number: formatNumber(normalized.length),
            });

  return (
    <fieldset className={`${styles.field} ${styles.fileTypeField}`}>
      <legend>{translate("assessment:files.allowed")}</legend>
      <details className={styles.fileTypeSelect}>
        <summary>
          <span>{summary}</span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className={styles.fileTypeMenu}>
          <div className={styles.fileTypeActions}>
            <button type="button" onClick={() => onChange(allExtensions)}>
              {translate("common:actions.selectAll")}
            </button>
            <button type="button" onClick={() => onChange([])}>
              {translate("common:actions.clear")}
            </button>
          </div>
          {groups.map((group) => (
            <div key={group} className={styles.fileTypeGroup}>
              <p>{translate(group)}</p>
              {options
                .filter((option) => option.groupKey === group)
                .map((option) => (
                  <label key={option.extension}>
                    <input
                      type="checkbox"
                      checked={selected.has(option.extension)}
                      onChange={() => toggle(option.extension)}
                    />
                    <strong>.{option.extension}</strong>
                    <span>{translate(option.labelKey)}</span>
                  </label>
                ))}
            </div>
          ))}
        </div>
      </details>
      <small className={styles.fileTypeHelp}>
        {translate("assessment:files.help")}
      </small>
    </fieldset>
  );
};
