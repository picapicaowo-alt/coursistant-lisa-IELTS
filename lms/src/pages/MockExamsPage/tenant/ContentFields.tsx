import { useTranslation } from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import {useId, useRef} from 'react';
import {useConfirmationDialog} from '@/components/TeachingWorkspace/useConfirmationDialog';
import {Plus, Trash2} from 'lucide-react';
import {isRecord} from '@/utils/apiError';
import {emptyValue, type Field} from './questionSchema';
import {hasAnswerSlot} from './answerKeys';
import {AnswerKeyFields} from './AnswerKeyFields';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './authoring.module.scss';

export function ContentFields({
  field,
  value,
  onChange,
  nextNumber,
  path: parentPath,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  nextNumber: () => number;
  path?: string;
}) {
  const { t: translate } = useTranslation();
  const path = parentPath ?? translate(field.labelKey);
  const helpId = useId();
  const confirmation = useConfirmationDialog(helpId);
  const latestValue = useRef(value);
  latestValue.current = value;
  if (field.type === 'object') {
    const record = isRecord(value) ? value : {};
    return (
      <div className={styles.fields}>
        {Object.entries(field.fields).map(([key, child]) => (
          <ContentFields
            key={key}
            field={child}
            value={record[key]}
            onChange={(next) => onChange({...record, [key]: next})}
            nextNumber={nextNumber}
            path={`${path} / ${translate(child.labelKey)}`}
          />
        ))}
        {hasAnswerSlot(field) ? (
          <AnswerKeyFields value={record} onChange={onChange} path={path} />
        ) : null}
      </div>
    );
  }
  if (field.type === 'variant') {
    const record = isRecord(value) ? value : {};
    const type =
      typeof record.type === 'string'
        ? record.type
        : Object.keys(field.variants)[0];
    return (
      <div className={styles.fields}>
        <label>
          <span>{translate('exams:authoring.fieldContent', {field: translate(field.labelKey)})}</span>
          <select
            aria-label={translate('exams:authoring.fieldContent', {field: path})}
            value={type}
            onChange={(event) => {
              const next = emptyValue(
                field.variants[event.target.value],
                nextNumber,
              );
              // Preserve both modes' content, including imported answer metadata,
              // so toggling text/blank does not erase work or renumber a blank.
              onChange({
                ...(isRecord(next) ? next : {}),
                ...record,
                type: event.target.value,
              });
            }}
          >
            {Object.entries(field.variants).map(([key, item]) => (
              <option key={key} value={key}>
                {translate(item.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <ContentFields
          field={field.variants[type]}
          value={record}
          onChange={onChange}
          nextNumber={nextNumber}
          path={path}
        />
      </div>
    );
  }
  if (field.type === 'list') {
    const items = Array.isArray(value) ? value : [];
    return (
      <fieldset className={styles.collection}>
        {confirmation.dialog}
        <legend>{translate(field.labelKey)}</legend>
        {items.map((item, index) => (
          <div className={styles.collectionItem} key={index}>
            <div className={styles.itemHeading}>
              <strong>
                {translate('exams:authoring.numberedField', {field: translate(field.item.labelKey), number: formatNumber(index + 1)})}
              </strong>
              <button
                type="button"
                className={ui.iconButton}
                aria-label={translate('common:actions.removeItem', {item: translate('exams:authoring.numberedField', {field: path, number: formatNumber(index + 1)})})}
                onClick={async () => {
                  if (
                    !await confirmation.confirm({titleKey: 'common:actions.remove', messageKey: 'exams:authoring.removeFieldConfirm', valueKeys: {field: field.item.labelKey}, values: {number: index + 1}})
                  )
                    return;
                  if (latestValue.current !== value) return;
                  onChange(items.filter((_, current) => current !== index));
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <ContentFields
              field={field.item}
              value={item}
              onChange={(next) =>
                onChange(
                  items.map((old, current) => (current === index ? next : old)),
                )
              }
              nextNumber={nextNumber}
              path={translate('exams:authoring.numberedField', {field: path, number: formatNumber(index + 1)})}
            />
          </div>
        ))}
        <button
          type="button"
          className={ui.textButton}
          onClick={() =>
            onChange([...items, emptyValue(field.item, nextNumber)])
          }
        >
          <Plus size={16} />
          {translate('common:actions.addItem', {item: translate(field.item.labelKey)})}
        </button>
      </fieldset>
    );
  }
  return (
    <label>
      <span>
        {field.optional ? translate('exams:authoring.optionalField', {field: translate(field.labelKey)}) : translate(field.labelKey)}
      </span>
      {field.type === 'choice' ? (
        <select
          aria-label={path}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.choices.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : field.type === 'number' ? (
        <input
          aria-label={path}
          type="number"
          min="1"
          step="1"
          value={typeof value === 'number' ? value : ''}
          onChange={(event) =>
            onChange(
              event.target.value === '' ? '' : Number(event.target.value),
            )
          }
        />
      ) : field.multiline ? (
        <textarea
          aria-label={path}
          rows={2}
          value={typeof value === 'string' ? value : ''}
          aria-describedby={field.hintKey ? helpId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          aria-label={path}
          value={typeof value === 'string' ? value : ''}
          aria-describedby={field.hintKey ? helpId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {field.hintKey ? <small id={helpId}>{translate(field.hintKey)}</small> : null}
    </label>
  );
}
