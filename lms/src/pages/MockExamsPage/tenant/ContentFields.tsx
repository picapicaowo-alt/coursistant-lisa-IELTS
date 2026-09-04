import {useId} from 'react';
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
  path = field.label,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  nextNumber: () => number;
  path?: string;
}) {
  const helpId = useId();
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
            path={`${path} / ${child.label}`}
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
          <span>{field.label} content</span>
          <select
            aria-label={`${path} content`}
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
                {item.label}
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
        <legend>{field.label}</legend>
        {items.map((item, index) => (
          <div className={styles.collectionItem} key={index}>
            <div className={styles.itemHeading}>
              <strong>
                {field.item.label} {index + 1}
              </strong>
              <button
                type="button"
                className={ui.iconButton}
                aria-label={`Remove ${path} ${index + 1}`}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Remove ${field.item.label.toLowerCase()} ${index + 1} and its content?`,
                    )
                  )
                    return;
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
              path={`${path} ${index + 1}`}
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
          Add {field.item.label.toLowerCase()}
        </button>
      </fieldset>
    );
  }
  return (
    <label>
      <span>
        {field.label}
        {field.optional ? ' (optional)' : ''}
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
          aria-describedby={field.hint ? helpId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          aria-label={path}
          value={typeof value === 'string' ? value : ''}
          aria-describedby={field.hint ? helpId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {field.hint ? <small id={helpId}>{field.hint}</small> : null}
    </label>
  );
}
