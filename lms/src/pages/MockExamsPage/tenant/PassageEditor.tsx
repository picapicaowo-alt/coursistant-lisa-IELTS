import {useState} from 'react';
import {ContentFields} from './ContentFields';
import {parseContent, type Field} from './questionSchema';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './authoring.module.scss';

const paragraphsField: Field = {
  type: 'list',
  label: 'Passage paragraphs',
  item: {type: 'text', label: 'Paragraph', multiline: true},
};
export function PassageEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const paragraphs = parseContent(value);
  const plain =
    Array.isArray(paragraphs) &&
    paragraphs.every((paragraph) => typeof paragraph === 'string');
  const [advanced, setAdvanced] = useState(false);
  return (
    <div className={styles.fields}>
      {plain ? (
        <ContentFields
          field={paragraphsField}
          value={paragraphs}
          onChange={(next) => onChange(JSON.stringify(next, null, 2))}
          nextNumber={() => 1}
        />
      ) : (
        <p className={styles.notice}>
          This passage uses imported structured content. Edit its data below;
          converting it automatically could lose formatting.
        </p>
      )}
      <details
        className={styles.advanced}
        open={advanced || !plain}
        onToggle={(event) => setAdvanced(event.currentTarget.open)}
      >
        <summary>Advanced paragraph data</summary>
        <p className={ui.hint}>
          Existing structured paragraphs remain unchanged unless you edit them
          here.
        </p>
        <label>
          <span>Paragraph data (JSON)</span>
          <textarea
            className={styles.code}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </details>
    </div>
  );
}
