import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  asRecord,
  collection,
  displayScalar,
  recordFieldLabel,
  isDisplayField,
  recordHeading,
} from "./recordPresentation";
import styles from "./RecordSummaryList.module.scss";

type RecordPresentation = {
  fieldLabel?: (key: string) => string;
  scalar?: (value: unknown, key?: string) => string | null;
};

const PAGE_SIZE = 20;
const MAX_DEPTH = 4;
function SummaryRows({
  items,
  depth,
  fieldLabel,
  scalar,
}: { items: unknown[]; depth: number } & RecordPresentation) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(PAGE_SIZE);
  return (
    <div className={styles.list}>
      {items.slice(0, limit).map((item, index) => (
        <RecordContent
          key={index}
          value={item}
          depth={depth}
          fieldLabel={fieldLabel}
          scalar={scalar}
        />
      ))}
      {items.length > limit ? (
        <button
          type="button"
          className={styles.more}
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
        >
          {t("common:admin.recordsMore", { count: items.length - limit })}
        </button>
      ) : null}
    </div>
  );
}

function RecordContent({
  value,
  depth,
  emptyMessage,
  fieldLabel = recordFieldLabel,
  scalar = displayScalar,
}: {
  value: unknown;
  depth: number;
  emptyMessage?: string;
} & RecordPresentation) {
  const { t } = useTranslation();
  const empty = emptyMessage ?? t("common:admin.noDetails");
  const items = collection(value);
  if (items)
    return items.length ? (
      <SummaryRows
        items={items}
        depth={depth}
        fieldLabel={fieldLabel}
        scalar={scalar}
      />
    ) : (
      <p className={styles.empty}>{empty}</p>
    );
  const record = asRecord(value);
  if (!record) return <p className={styles.empty}>{scalar(value) ?? empty}</p>;
  const { title, consumed } = recordHeading(record);
  const entries = Object.entries(record).filter(
    ([key]) => isDisplayField(key) && !consumed.has(key),
  );
  const fields = entries.flatMap(([key, value]) => {
    const display = scalar(value, key);
    return display == null ? [] : [{ key, display }];
  });
  const groups =
    depth < MAX_DEPTH
      ? entries.filter(
          ([, value]) => value != null && typeof value === "object",
        )
      : [];
  if (!title && !fields.length && !groups.length)
    return <p className={styles.empty}>{empty}</p>;
  return (
    <article className={styles.row}>
      {title ? <strong className={styles.title}>{title}</strong> : null}
      {fields.length ? (
        <dl className={styles.facts}>
          {fields.map(({ key, display }) => (
            <div key={key} data-long={display.length > 90 || undefined}>
              <dt>{fieldLabel(key)}</dt>
              <dd>{display}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {groups.length ? (
        <div className={styles.groups}>
          {groups.map(([key, child]) => (
            <section key={key} aria-label={fieldLabel(key)}>
              <h4>{fieldLabel(key)}</h4>
              <RecordContent
                value={child}
                depth={depth + 1}
                emptyMessage={t("common:admin.recordsEmptyGroup", {
                  label: fieldLabel(key),
                })}
                fieldLabel={fieldLabel}
                scalar={scalar}
              />
            </section>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/** Displays only values actually returned by generic reads; never substitutes a success message for missing content. */
export const RecordSummaryList = ({
  value,
  emptyMessage,
  fieldLabel,
  scalar,
}: {
  value: unknown;
  emptyMessage?: string;
} & RecordPresentation) => (
  <RecordContent
    value={value}
    depth={0}
    emptyMessage={emptyMessage}
    fieldLabel={fieldLabel}
    scalar={scalar}
  />
);
