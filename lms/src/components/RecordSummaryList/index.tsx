import { useState } from "react";
import {
  asRecord,
  collection,
  displayScalar,
  humanize,
  isDisplayField,
  recordHeading,
} from "./recordPresentation";
import styles from "./RecordSummaryList.module.scss";

const PAGE_SIZE = 20;
const MAX_DEPTH = 4;
function SummaryRows({ items, depth }: { items: unknown[]; depth: number }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  return (
    <div className={styles.list}>
      {items.slice(0, limit).map((item, index) => (
        <RecordContent key={index} value={item} depth={depth} />
      ))}
      {items.length > limit ? (
        <button
          type="button"
          className={styles.more}
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
        >
          Show more ({items.length - limit} remaining)
        </button>
      ) : null}
    </div>
  );
}

function RecordContent({
  value,
  depth,
  emptyMessage = "No details are available.",
}: {
  value: unknown;
  depth: number;
  emptyMessage?: string;
}) {
  const items = collection(value);
  if (items)
    return items.length ? (
      <SummaryRows items={items} depth={depth} />
    ) : (
      <p className={styles.empty}>{emptyMessage}</p>
    );
  const record = asRecord(value);
  if (!record)
    return (
      <p className={styles.empty}>{displayScalar(value) ?? emptyMessage}</p>
    );
  const { title, consumed } = recordHeading(record);
  const entries = Object.entries(record).filter(
    ([key]) => isDisplayField(key) && !consumed.has(key),
  );
  const fields = entries.flatMap(([key, value]) => {
    const display = displayScalar(value);
    return display == null ? [] : [{ key, display }];
  });
  const groups =
    depth < MAX_DEPTH
      ? entries.filter(
          ([, value]) => value != null && typeof value === "object",
        )
      : [];
  if (!title && !fields.length && !groups.length)
    return <p className={styles.empty}>{emptyMessage}</p>;
  return (
    <article className={styles.row}>
      {title ? <strong className={styles.title}>{title}</strong> : null}
      {fields.length ? (
        <dl className={styles.facts}>
          {fields.map(({ key, display }) => (
            <div key={key} data-long={display.length > 90 || undefined}>
              <dt>{humanize(key)}</dt>
              <dd>{display}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {groups.length ? (
        <div className={styles.groups}>
          {groups.map(([key, child]) => (
            <section key={key} aria-label={humanize(key)}>
              <h4>{humanize(key)}</h4>
              <RecordContent
                value={child}
                depth={depth + 1}
                emptyMessage={`No ${humanize(key).toLowerCase()} to show.`}
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
  emptyMessage = "No records are available.",
}: {
  value: unknown;
  emptyMessage?: string;
}) => <RecordContent value={value} depth={0} emptyMessage={emptyMessage} />;
