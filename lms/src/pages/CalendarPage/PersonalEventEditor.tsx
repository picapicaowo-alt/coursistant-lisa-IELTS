import {useEffect, useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type PersonalEventRequest} from '@/apis';
import {courseOperationsApiService as api} from '@/apis/services/course-operations-api';
import {EnglishDateTimeInput} from '@/components/EnglishDateInput';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorMessage} from '@/utils/apiError';
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
  const dialog = useAnchoredEventDialog(anchor);
  const [current, setCurrent] = useState(selected);
  const [loading, setLoading] = useState(Boolean(selected));
  const [readError, setReadError] = useState<unknown>();
  const [confirmDelete, setConfirmDelete] = useState(false);
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
          throw new Error(
            'This event does not contain the fields needed for editing.',
          );
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
      if (action === 'delete' && current)
        return checkpoint.run(`delete-event-${current.id}`, current.id, (key) =>
          api.deleteMyPersonalEvent(current.id, key),
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
        if (current.version == null)
          throw new Error(
            'Reload an event with a current version before saving changes.',
          );
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
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalidTime) save.mutate('save');
        }}
      >
        <header>
          <h2 id="personal-event-title">
            {selected ? 'Edit personal event' : 'Add personal event'}
          </h2>
          <button
            type="button"
            aria-label="Close event"
            disabled={save.isPending}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {loading ? <p role="status">Loading latest event…</p> : null}
        {readError ? (
          <p role="alert">
            {getApiErrorMessage(readError, 'The event could not be loaded.')}
          </p>
        ) : null}
        <fieldset disabled={loading || Boolean(readError) || save.isPending}>
          <label>
            Event title
            <input
              required
              value={event.title ?? ''}
              onChange={(e) => setEvent({...event, title: e.target.value})}
            />
          </label>
          <div className={styles.dateFields}>
            <label>
              Starts
              <EnglishDateTimeInput
                required
                value={event.startsAtLocal ?? ''}
                onChangeValue={(startsAtLocal) =>
                  setEvent({...event, startsAtLocal})
                }
              />
            </label>
            <label>
              Ends
              <EnglishDateTimeInput
                required
                value={event.endsAtLocal ?? ''}
                onChangeValue={(endsAtLocal) =>
                  setEvent({...event, endsAtLocal})
                }
              />
            </label>
          </div>
          <label>
            Timezone
            <input
              required
              value={event.timezone ?? ''}
              onChange={(e) => setEvent({...event, timezone: e.target.value})}
            />
          </label>
          <label>
            Reminder (minutes before)
            <input
              type="number"
              min="0"
              step="1"
              value={event.reminderMinutesBefore ?? ''}
              onChange={(e) =>
                setEvent({
                  ...event,
                  reminderMinutesBefore:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
          {invalidTime ? (
            <p role="alert">End time must be after start time.</p>
          ) : null}
          {current && current.version == null ? (
            <p role="alert">
              The event has no current version. Refresh it before saving
              changes.
            </p>
          ) : null}
        </fieldset>
        {save.isError ? (
          <p role="alert">
            {getApiErrorMessage(
              save.error,
              'The event could not be saved. Your entries are preserved.',
            )}
          </p>
        ) : null}
        {confirmDelete ? (
          <div className={styles.deleteConfirm}>
            <p>Delete “{current?.title}”?</p>
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate('delete')}
            >
              Delete event
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Keep event
            </button>
          </div>
        ) : null}
        <footer>
          {selected ? (
            <button
              type="button"
              disabled={save.isPending || loading || Boolean(readError)}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          ) : null}
          <button type="button" disabled={save.isPending} onClick={onClose}>
            Cancel
          </button>
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
              ? 'Saving…'
              : selected
                ? 'Save changes'
                : 'Create event'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
