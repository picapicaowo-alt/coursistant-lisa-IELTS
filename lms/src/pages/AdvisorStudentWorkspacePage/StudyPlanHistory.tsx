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

const fieldLabel = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, letter => letter.toUpperCase());

/** The contract leaves snapshot as an open object: retain its actual keys and nested values. */
function SnapshotValue({value}: {value: unknown}) {
  if (value == null || value === '') return <span className={styles.empty}>Not recorded</span>;
  if (Array.isArray(value)) return value.length
    ? <ol className={styles.items}>{value.map((item, index) => <li key={index}><SnapshotValue value={item}/></li>)}</ol>
    : <span className={styles.empty}>No items</span>;
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length ? <dl className={styles.fields}>{entries.map(([key, item]) => <div key={key}><dt>{fieldLabel(key)}</dt><dd><SnapshotValue value={item}/></dd></div>)}</dl> : <span className={styles.empty}>No recorded fields</span>;
  }
  return <span className={styles.value}>{typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}</span>;
}

export function StudyPlanHistory({studentUserId}: {studentUserId: number}) {
  const [page, setPage] = useState(0);
  const query = useQuery({
    meta: {advisingStudentId: studentUserId},
    queryKey: advisingQueryKeys.advisorRevisions(studentUserId, page),
    queryFn: async () => unwrapData(await advisorApiService.listStudyPlanRevisions(studentUserId, page, ADVISOR_PAGE_SIZE), 'listRevisions'),
    retry: false,
  });
  return <CollapsibleSection
    title="Version history"
    id="study-plan-history"
    className={styles.history}
    summary={query.isError ? 'History could not be loaded. Open to retry.' : 'Review saved study plans without changing your current draft.'}
    count={query.data?.total}
  >
    {query.isPending ? <p role="status">Loading version history…</p> : query.isError ? <div role="alert"><p>{advisingErrorMessage(query.error, 'Version history could not be loaded.')}</p><button type="button" className={shared.secondary} onClick={() => void query.refetch()}>Retry history</button></div> : <>
      {query.data?.items?.length === 0 ? <p>No saved revisions were returned.</p> : null}
      {(query.data?.items ?? []).map((revision, index) => {
        const hasSnapshot = revision.snapshot != null && Object.keys(revision.snapshot).length > 0;
        const action = revision.action === 'STUDY_PLAN_CREATED' ? 'Plan created' : revision.action === 'STUDY_PLAN_UPDATED' ? 'Plan updated' : 'Plan saved';
        return <CollapsibleSection
          key={`${studentUserId}-${page}-${revision.entityVersion}-${revision.createdAt}-${index}`}
          title={revision.entityVersion == null ? 'Saved version' : `Version ${revision.entityVersion}`}
          headingLevel={3}
          summary={[action, revision.createdAt, revision.actorId == null ? null : `Actor #${revision.actorId}`].filter(Boolean).join(' · ')}
          meta={<span className={shared.readOnlyBadge}>Read only</span>}
        >
          {hasSnapshot ? <SnapshotValue value={revision.snapshot}/> : <p>The saved content for this version was not included. Only its revision details are available.</p>}
        </CollapsibleSection>;
      })}
      {query.data ? <AdvisingPagination label="Version history pages" page={page} size={ADVISOR_PAGE_SIZE} total={query.data.total} onPage={setPage}/> : null}
    </>}
  </CollapsibleSection>;
}
