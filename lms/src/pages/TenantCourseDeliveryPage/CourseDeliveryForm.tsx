import { useTranslation } from 'react-i18next';
import {useEffect, useState, type FormEvent} from 'react';
import {Pencil} from 'lucide-react';
import type {CourseDeliveryConfigResponse} from '@/apis';
import {formatNumber} from '@/i18n/formatting';
import {CATALOG_CODE_MAX_LENGTH, courseDeliveryLabel, validDeliveryDraft} from '../advising/courseManagement';
import styles from '../advising/CourseManagement.module.scss';

export interface DeliveryDraft { catalogCode: string; capacity: string }

export function CourseDeliveryForm({config, draft, pending, canEdit, onDraft, onSubmit}: {
  config?: CourseDeliveryConfigResponse | null;
  draft: DeliveryDraft;
  pending: boolean;
  canEdit: boolean;
  onDraft: (draft: DeliveryDraft) => void;
  onSubmit: () => Promise<unknown>;
}) {
  const { t: translate } = useTranslation();
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (config === null) setEditing(true); }, [config]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit || pending || !validDeliveryDraft(draft)) return;
    try { await onSubmit(); setEditing(false); } catch { /* The mutation exposes its recoverable error in the page status. */ }
  };
  return <section className={styles.panel} aria-labelledby="delivery-details-title">
    <header className={styles.panelHeader}><h2 id="delivery-details-title">{translate("courseTools:delivery.details")}</h2>{!editing && canEdit ? <button type="button" className={styles.textAction} onClick={() => setEditing(true)}><Pencil size={15} aria-hidden="true" />{translate("courseTools:delivery.editDetails")}</button> : null}</header>
    {editing ? <form className={styles.formGrid} noValidate onSubmit={submit}>
      <label className={styles.field}>{translate("courseTools:delivery.catalogCode")}<input required disabled={pending} maxLength={CATALOG_CODE_MAX_LENGTH} value={draft.catalogCode} onChange={event => onDraft({...draft, catalogCode: event.target.value})} /></label>
      <label className={styles.field}>{translate("courseTools:delivery.capacity")}<input required disabled={pending} min="1" step="1" type="number" inputMode="numeric" value={draft.capacity} onChange={event => onDraft({...draft, capacity: event.target.value})} /></label>
      <div className={styles.formActions}>{config ? <button type="button" disabled={pending} className={styles.secondaryButton} onClick={() => {onDraft({catalogCode: config.catalogCode ?? '', capacity: config.capacity == null ? '' : String(config.capacity)}); setEditing(false);}}>{translate("common:actions.cancel")}</button> : null}<button type="submit" className={styles.softPrimaryButton} disabled={pending || !canEdit || !validDeliveryDraft(draft)}>{pending ? translate("common:actions.saving") : config ? translate("common:actions.saveChanges") : translate("courseTools:delivery.configure")}</button></div>
    </form> : <dl className={styles.detailFacts}>
      <div><dt>{translate("courseTools:delivery.catalogCode")}</dt><dd>{config?.catalogCode || translate("courseTools:delivery.notConfigured")}</dd></div>
      <div><dt>{translate("courseTools:delivery.capacity")}</dt><dd>{config?.capacity == null ? translate("courseTools:delivery.notConfigured") : translate('courseTools:delivery.students', {count: config.capacity, number: formatNumber(config.capacity)})}</dd></div>
      <div><dt>{translate("courseTools:delivery.type")}</dt><dd>{courseDeliveryLabel(config?.deliveryMode)}</dd></div>
      <div><dt>{translate("courseTools:delivery.launchVersion")}</dt><dd>{config?.courseLaunchVersion == null ? translate("courseTools:delivery.notConfigured") : translate('courseTools:delivery.version', {number: formatNumber(config.courseLaunchVersion)})}</dd></div>
    </dl>}
  </section>;
}
