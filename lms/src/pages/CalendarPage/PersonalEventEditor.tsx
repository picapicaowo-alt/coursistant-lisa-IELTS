import { useTranslation } from 'react-i18next';
import {useEffect, useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type PersonalEventRequest} from '@/apis';
import {courseOperationsApiService as api} from '@/apis/services/course-operations-api';
import {EnglishDateTimeInput} from '@/components/EnglishDateInput';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {isPersonalEventVersionConflict, personalEventErrorKey} from '@/utils/personalEventError';
import {LocalizedError} from '@/i18n/errors';
import {personalEventView, type PersonalEventView} from './personalEvents';
import {useAnchoredEventDialog} from './useAnchoredEventDialog';
import styles from './index.module.scss';

const wholeSeconds = (value?: string) =>
  value?.length === 16 ? `${value}:00` : value;
export function PersonalEventEditor({
  selected,
  onClose,
  anchor,
}: {
  anchor?: HTMLElement;
  selected: PersonalEventView | null;
  onClose: () => void;
}) {
  const { t: translate } = useTranslation();
  const dialog = useAnchoredEventDialog(anchor);
  const [current, setCurrent] = useState(selected);
  const [loading, setLoading] = useState(Boolean(selected));
  const [readError, setReadError] = useState<unknown>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [invalidReminderInput, setInvalidReminderInput] = useState(false);
  const [event, setEvent] = useState<PersonalEventRequest>(
    () =>
      selected ?? {
        title: '',
        startsAtLocal: '',
        endsAtLocal: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
  );
  const client = useQueryClient();
  const checkpoint = useIdempotencyCheckpoint();

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    api
      .getMyPersonalEvent(selected.id)
      .then((response) => {
        const latest = personalEventView(unwrapData(response, 'personalEvent'));
        if (!latest)
          throw new LocalizedError('calendar:editor.missingDetails');
        if (!cancelled) {
          setCurrent(latest);
          setEvent(latest);
        }
      })
      .catch((error) => {
        if (!cancelled) setReadError(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);
  const save = useMutation({
    mutationFn: (action: 'save' | 'delete') => {
      if (current && current.version == null)
        throw new LocalizedError('calendar:editor.missingVersion');
      if (action === 'delete' && current)
        return checkpoint.run(`delete-event-${current.id}`, {id: current.id, expectedVersion: current.version}, (key, request) =>
          api.deleteMyPersonalEvent(request.id, key, request.expectedVersion),
        );
      // Construct only contract request fields. Do not submit read-only identity/version aliases.
      const payload: PersonalEventRequest = {
        title: event.title?.trim(),
        startsAtLocal: wholeSeconds(event.startsAtLocal),
        endsAtLocal: wholeSeconds(event.endsAtLocal),
        timezone: event.timezone,
        reminderMinutesBefore: event.reminderMinutesBefore,
      };
      if (current) {
        return checkpoint.run(
          `update-event-${current.id}`,
          {...payload, expectedVersion: current.version},
          (key, request) => api.patchMyPersonalEvent(current.id, request, key),
        );
      }
      return checkpoint.run('create-personal-event', payload, (key, request) =>
        api.createMyPersonalEvent(request, key),
      );
    },
    onError: async (error) => {
      if (!isPersonalEventVersionConflict(error) || !current) return;
      setConfirmDelete(false);
      setLoading(true);
      try {
        const latest = personalEventView(unwrapData(await api.getMyPersonalEvent(current.id), 'personalEvent'));
        if (!latest) throw new LocalizedError('calendar:editor.missingDetails');
        setCurrent(latest);
        setEvent(latest);
        await client.invalidateQueries({queryKey: ['me', 'personal-events']});
      } catch (readFailure) {
        setReadError(readFailure);
      } finally {
        setLoading(false);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({queryKey: ['me', 'personal-events']}),
        client.invalidateQueries({queryKey: ['me', 'calendar']}),
      ]);
      onClose();
    },
  });
  const invalidTime = Boolean(
    event.startsAtLocal &&
      event.endsAtLocal &&
      event.endsAtLocal <= event.startsAtLocal,
  );
  const validationKey = !event.title?.trim() ? 'calendar:editor.requiredTitle'
    : !event.startsAtLocal || !event.endsAtLocal ? 'calendar:editor.validDates'
    : !event.timezone?.trim() ? 'calendar:editor.requiredTimezone'
    : invalidReminderInput || event.reminderMinutesBefore != null && (!Number.isSafeInteger(event.reminderMinutesBefore) || event.reminderMinutesBefore < 0) ? 'calendar:editor.invalidReminder'
    : undefined;
  return (
    <dialog
      ref={dialog}
      className={styles.eventDialog}
      aria-labelledby="personal-event-title"
      onCancel={(e) => {
        if (save.isPending) e.preventDefault();
      }}
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setShowValidation(true);
          if (!invalidTime && !validationKey && !loading && !readError && !save.isPending) save.mutate('save');
        }}
      >
        <header>
          <h2 id="personal-event-title">
            {translate(selected ? 'calendar:editor.editTitle' : 'calendar:editor.addTitle')}
          </h2>
          <button
            type="button"
            aria-label={translate('calendar:editor.close')}
            disabled={save.isPending}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {loading ? <p role="status">{translate('calendar:editor.loading')}</p> : null}
        {readError ? (
          <p role="alert">
            {readError instanceof LocalizedError ? readError.localizedMessage() : translate('calendar:editor.loadFailed')}
          </p>
        ) : null}
        <fieldset disabled={loading || Boolean(readError) || save.isPending}>
          <label>
            {translate('calendar:editor.title')}
            <input
              required
              aria-invalid={showValidation && !event.title?.trim() || undefined}
              value={event.title ?? ''}
              onChange={(e) => setEvent({...event, title: e.target.value})}
            />
          </label>
          <div className={styles.dateFields}>
            <label>
              {translate('calendar:editor.starts')}
              <EnglishDateTimeInput
                required
                aria-label={translate('calendar:editor.starts')}
                value={event.startsAtLocal ?? ''}
                onChangeValue={(startsAtLocal) =>
                  setEvent({...event, startsAtLocal})
                }
              />
            </label>
            <label>
              {translate('calendar:editor.ends')}
              <EnglishDateTimeInput
                required
                aria-label={translate('calendar:editor.ends')}
                value={event.endsAtLocal ?? ''}
                onChangeValue={(endsAtLocal) =>
                  setEvent({...event, endsAtLocal})
                }
              />
            </label>
          </div>
          <label>
            {translate('calendar:editor.timezone')}
            <input
              required
              value={event.timezone ?? ''}
              onChange={(e) => setEvent({...event, timezone: e.target.value})}
            />
          </label>
          <label>
            {translate('calendar:editor.reminder')}
            <input
              type="number"
              min="0"
              step="1"
              value={event.reminderMinutesBefore ?? ''}
              aria-invalid={showValidation && validationKey === 'calendar:editor.invalidReminder' || undefined}
              onChange={(e) => {
                setInvalidReminderInput(!e.currentTarget.validity.valid);
                setEvent({
                  ...event,
                  reminderMinutesBefore:
                    e.target.value === '' ? undefined : Number(e.target.value),
                });
              }}
            />
          </label>
          {invalidTime ? (
            <p role="alert">{translate('calendar:editor.invalidTime')}</p>
          ) : null}
          {current && current.version == null ? (
            <p role="alert">
              {translate('calendar:editor.missingVersion')}
            </p>
          ) : null}
        </fieldset>
        {showValidation && validationKey ? <p role="alert">{translate(validationKey)}</p> : null}
        {save.isError ? (
          <p role="alert">
            {save.error instanceof LocalizedError ? save.error.localizedMessage() : translate(personalEventErrorKey(save.error, save.variables === 'delete'))}
          </p>
        ) : null}
        {confirmDelete ? (
          <div className={styles.deleteConfirm}>
            <p>{translate('calendar:editor.deleteConfirm', {title: current?.title})}</p>
            <button
              type="button"
              disabled={save.isPending || loading || Boolean(readError)}
              onClick={() => save.mutate('delete')}
            >
              {translate('calendar:editor.delete')}
            </button>
            <button type="button" disabled={save.isPending} onClick={() => setConfirmDelete(false)}>
              {translate('calendar:editor.keep')}
            </button>
          </div>
        ) : null}
        <footer>
          {selected ? (
            <button
              type="button"
              disabled={save.isPending || loading || Boolean(readError) || current?.version == null}
              onClick={() => setConfirmDelete(true)}
            >
              {translate("common:actions.delete")}</button>
          ) : null}
          <button type="button" disabled={save.isPending} onClick={onClose}>
            {translate("common:actions.cancel")}</button>
          <button
            className={styles.primary}
            disabled={
              save.isPending ||
              loading ||
              Boolean(readError) ||
              invalidTime ||
              Boolean(current && current.version == null)
            }
          >
            {save.isPending
              ? translate(save.variables === 'delete' ? 'common:actions.deleting' : 'common:actions.saving')
              : selected
                ? translate('common:actions.saveChanges')
                : translate('calendar:editor.create')}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
