import {useTranslation} from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import {formatUtcTimestamp} from '@/utils/datetime';
import {displayScalar, recordFieldLabel} from '@/components/RecordSummaryList/recordPresentation';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import shared from '../advising/advising.module.scss';
import styles from './StudyPlanHistory.module.scss';

/** The contract leaves snapshot as an open object: retain its actual keys and nested values. */
function SnapshotValue({value, fieldKey}: {value: unknown; fieldKey?: string}) {
  const {t: translate} = useTranslation();
  if (value == null || value === '') return <span className={styles.empty}>{translate("operations:notRecorded")}</span>;
  if (Array.isArray(value)) return value.length
    ? <ol className={styles.items}>{value.map((item, index) => <li key={index}><SnapshotValue value={item} fieldKey={fieldKey}/></li>)}</ol>
    : <span className={styles.empty}>{translate("advising:history.noItems")}</span>;
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length ? <dl className={styles.fields}>{entries.map(([key, item]) => <div key={key}><dt>{recordFieldLabel(key)}</dt><dd><SnapshotValue value={item} fieldKey={key}/></dd></div>)}</dl> : <span className={styles.empty}>{translate("advising:history.noFields")}</span>;
  }
  return <span className={styles.value}>{displayScalar(value, fieldKey) ?? String(value)}</span>;
}

export function StudyPlanHistory({studentUserId}: {studentUserId: number}) {
  const {t: translate} = useTranslation();
  const [page, setPage] = useState(0);
  const query = useQuery({
    meta: {advisingStudentId: studentUserId},
    queryKey: advisingQueryKeys.advisorRevisions(studentUserId, page),
    queryFn: async () => unwrapData(await advisorApiService.listStudyPlanRevisions(studentUserId, page, ADVISOR_PAGE_SIZE), 'listRevisions'),
    retry: false,
  });
  return <CollapsibleSection
    title={translate("advising:history.title")}
    id="study-plan-history"
    className={styles.history}
    summary={query.isError ? translate("advising:history.failedSummary") : translate("advising:history.help")}
    count={query.data?.total}
  >
    {query.isPending ? <p role="status">{translate("advising:history.loading")}</p> : query.isError ? <div role="alert"><p>{advisingErrorMessage(query.error, translate('advising:history.loadFailed'))}</p><button type="button" className={shared.secondary} onClick={() => void query.refetch()}>{translate("advising:history.retry")}</button></div> : <>
      {query.data?.items?.length === 0 ? <p>{translate("advising:history.empty")}</p> : null}
      {(query.data?.items ?? []).map((revision, index) => {
        const hasSnapshot = revision.snapshot != null && Object.keys(revision.snapshot).length > 0;
        const action = revision.action === 'STUDY_PLAN_CREATED' ? translate("advising:history.created") : revision.action === 'STUDY_PLAN_UPDATED' ? translate("advising:history.updated") : translate("advising:history.saved");
        return <CollapsibleSection
          key={`${studentUserId}-${page}-${revision.entityVersion}-${revision.createdAt}-${index}`}
          title={revision.entityVersion == null ? translate("advising:history.savedVersion") : translate('operations:availability.version', {number: formatNumber(revision.entityVersion)})}
          headingLevel={3}
          summary={[action, revision.createdAt ? formatUtcTimestamp(revision.createdAt) : null, revision.actorId == null ? null : translate('advising:history.actor', {number: formatNumber(revision.actorId)})].filter(Boolean).join(' · ')}
          meta={<span className={shared.readOnlyBadge}>{translate("courseTools:owner.readOnly")}</span>}
        >
          {hasSnapshot ? <SnapshotValue value={revision.snapshot}/> : <p>{translate("advising:history.noSnapshot")}</p>}
        </CollapsibleSection>;
      })}
      {query.data ? <AdvisingPagination label={translate("advising:history.pages")} page={page} size={ADVISOR_PAGE_SIZE} total={query.data.total} onPage={setPage}/> : null}
    </>}
  </CollapsibleSection>;
}
