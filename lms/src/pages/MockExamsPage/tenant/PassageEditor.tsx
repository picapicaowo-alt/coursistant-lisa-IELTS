import {useTranslation} from 'react-i18next';
import {useState} from 'react';
import {ContentFields} from './ContentFields';
import {parseContent, type Field} from './questionSchema';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './authoring.module.scss';

const paragraphsField: Field = {
  type: 'list',
  labelKey: "exams:schema.paragraphs",
  item: {type: 'text', labelKey: "exams:schema.paragraph", multiline: true},
};
export function PassageEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const {t: translate} = useTranslation();
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
          {translate("exams:authoring.structuredPassageHelp")}</p>
      )}
      <details
        className={styles.advanced}
        open={advanced || !plain}
        onToggle={(event) => setAdvanced(event.currentTarget.open)}
      >
        <summary>{translate("exams:authoring.advancedParagraphs")}</summary>
        <p className={ui.hint}>
          {translate("exams:authoring.paragraphsPreserved")}</p>
        <label>
          <span>{translate("exams:authoring.paragraphData")}</span>
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
