import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {ADVISING_ERROR_CODES, unwrapData} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {isHttpStatus, isMissingResource} from '@/utils/apiError';
import {formatClockTime, formatWeekday} from '@/i18n/formatting';
import {formatInputDate} from '@/i18n/dateInput';
import styles from '../advising/advising.module.scss';
import layout from './OperationsWorkspace.module.scss';

export function InstructorAvailabilityPanel() {
  const {t} = useTranslation('advising');
  const [instructorId, setInstructorId] = useState('');
  const [requestedId, setRequestedId] = useState<number | null>(null);
  const availability = useQuery({
    queryKey: ['advisor', 'instructor-availability', requestedId],
    queryFn: async () => unwrapData(
      await courseOperationsApiService.getAdvisorInstructorAvailability(requestedId!),
      'advisorInstructorAvailability'
    ),
    enabled: requestedId != null,
    retry: false,
  });
  const selectedId = Number(instructorId);
  const showResult = requestedId != null && requestedId === selectedId;
  const errorKey = isHttpStatus(availability.error, 401) ? 'availability.sessionExpired'
    : isHttpStatus(availability.error, 403) ? 'availability.forbidden'
    : isMissingResource(availability.error, ADVISING_ERROR_CODES.instructorNotFound) ? 'availability.instructorUnavailable' : 'availability.loadError';
  const result = availability.data;
  const windows = result?.windows ?? [];
  const exceptions = result?.exceptions ?? [];

  return <WorkspaceSection title={t('availability.title')} className={layout.secondary}>
    <form noValidate className={styles.inlineLookup} onSubmit={event => {
      event.preventDefault();
      if (!Number.isInteger(selectedId) || selectedId <= 0) return;
      // Setting the same query key again does not retry a failed request.
      if (requestedId === selectedId) void availability.refetch();
      else setRequestedId(selectedId);
    }}>
      <AdvisorInstructorPicker required value={instructorId} onChange={value => {
        setInstructorId(value);
        // A late response for the previous selection must never describe this teacher.
        setRequestedId(null);
      }}/>
      <button type="submit" className={styles.primary}
        disabled={!Number.isInteger(selectedId) || selectedId <= 0 || (showResult && availability.isFetching)}>
        {showResult && availability.isFetching ? t('availability.loading') : t('availability.check')}
      </button>
    </form>
    {showResult && availability.isError && !availability.isFetching ? <p className={styles.error} role="alert">{t(errorKey)}</p> : null}
    {showResult && availability.isFetching ? <p className={styles.status} role="status">{t('availability.loading')}</p> : null}
    {showResult && availability.isSuccess && !availability.isFetching ? <div className={styles.compactResult}>
      {!windows.length && !exceptions.length ? <p>{t('availability.empty')}</p> : <>
        {windows.length ? <section aria-label={t('availability.windows')}>
          <h3>{t('availability.windows')}</h3>
          <RecordSummaryList value={windows.map(window => ({...window,
            dayOfWeek: window.dayOfWeek ? formatWeekday(window.dayOfWeek) : undefined,
            effectiveFrom: window.effectiveFrom ? formatInputDate(window.effectiveFrom) || window.effectiveFrom : undefined,
            effectiveTo: window.effectiveTo ? formatInputDate(window.effectiveTo) || window.effectiveTo : undefined,
            startTime: window.startTime ? formatClockTime(window.startTime) : undefined,
            endTime: window.endTime ? formatClockTime(window.endTime) : undefined,
          }))} fieldLabel={key => t(`availability.fields.${key}`)}/>
        </section> : null}
        {exceptions.length ? <section aria-label={t('availability.exceptions')}>
          <h3>{t('availability.exceptions')}</h3>
          <RecordSummaryList value={exceptions.map(exception => ({...exception,
            exceptionDate: exception.exceptionDate ? formatInputDate(exception.exceptionDate) || exception.exceptionDate : undefined,
            startTime: exception.startTime ? formatClockTime(exception.startTime) : undefined,
            endTime: exception.endTime ? formatClockTime(exception.endTime) : undefined,
          }))} fieldLabel={key => t(`availability.fields.${key}`)}/>
        </section> : null}
      </>}
    </div> : null}
  </WorkspaceSection>;
}
