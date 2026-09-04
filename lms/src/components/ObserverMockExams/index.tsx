import {useEffect, useRef, useState, type ReactNode} from 'react';
import {CalendarDays, ClipboardCheck, FileCheck2, X} from 'lucide-react';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {getApiErrorMessage} from '@/utils/apiError';
import {formatUtcTimestamp} from '@/utils/datetime';
import {normalizeStudentExams} from '@/utils/mockExamSummary';
import styles from './index.module.scss';

const PAGE_SIZE = 20;

/** Observer detail stays in the current role; it never links to a student attempt. */
export const ObserverMockExams = ({scope, studentUserId, onCountChange, emptyState}: {scope: 'advisor' | 'parent'; studentUserId: number; onCountChange?: (count: number | undefined) => void; emptyState?: ReactNode}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const list = useQuery({
    queryKey: ['mock-exams', scope, 'student', studentUserId],
    meta: scope === 'advisor' ? {advisingStudentId: studentUserId} : undefined,
    queryFn: async () => unwrapData(await (scope === 'advisor' ? mockExamApiService.listAdvisorStudentExams(studentUserId) : mockExamApiService.listParentStudentExams(studentUserId)), 'observerMockExams'),
    retry: false,
  });
  const detail = useQuery({
    queryKey: ['mock-exams', scope, 'student', studentUserId, 'detail', selectedId],
    meta: scope === 'advisor' ? {advisingStudentId: studentUserId} : undefined,
    queryFn: async () => unwrapData(await (scope === 'advisor' ? mockExamApiService.getAdvisorStudentExam(studentUserId, selectedId!) : mockExamApiService.getParentStudentExam(studentUserId, selectedId!)), 'observerMockExamDetail'),
    enabled: selectedId != null,
    retry: false,
  });
  const allRows = normalizeStudentExams(list.data);
  useEffect(() => {
    onCountChange?.(list.isSuccess ? allRows.length : undefined);
  }, [onCountChange, list.isSuccess, allRows.length]);
  const rows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const exam = detail.data;
  useEffect(() => {if (selectedId != null) dialog.current?.showModal();}, [selectedId]);
  return <div className={styles.workspace} data-scope={scope}>
    {list.isPending ? <p role="status">Loading assigned papers…</p> : null}
    {list.isError ? <div role="alert"><p>{getApiErrorMessage(list.error, 'Assigned papers could not be loaded.')}</p><button onClick={() => void list.refetch()}>Retry</button></div> : null}
    {list.isSuccess && rows.length === 0 ? emptyState ?? <p>No assigned mock exams.</p> : null}
    <div className={styles.paperGrid}>{rows.map(row => {
      const sectionResults = row.sections.filter(section => row.results[section]);
      return <article className={styles.record} key={row.id}>
        <header className={styles.recordHeader}>
          <span className={styles.examIcon}><ClipboardCheck size={22} aria-hidden="true"/></span>
          <span className={styles.status}>{(row.attemptStatus || row.status).replace(/_/g, ' ')}</span>
        </header>
        <div className={styles.recordTitle}>
          <h3>{row.title}</h3>
          <p>{row.label}</p>
        </div>
        <dl className={styles.examFacts}>
          <div>
            <dt><FileCheck2 size={15} aria-hidden="true"/>Sections</dt>
            <dd>{row.sections.length ? row.sections.map(section => section[0].toUpperCase() + section.slice(1)).join(' · ') : 'Not supplied'}</dd>
          </div>
          <div>
            <dt><CalendarDays size={15} aria-hidden="true"/>Assigned</dt>
            <dd>{row.assignedAt ? <time dateTime={row.assignedAt}>{formatUtcTimestamp(row.assignedAt, {month: 'short', day: 'numeric', year: 'numeric'})}</time> : 'Not supplied'}</dd>
          </div>
        </dl>
        {sectionResults.length ? <dl className={styles.scoreStrip} aria-label="Released section results">
          {sectionResults.map(section => <div key={section}><dt>{section.slice(0, 1).toUpperCase()}</dt><dd>{row.results[section]}</dd></div>)}
        </dl> : null}
        <footer className={styles.recordFooter}>
          <span>{sectionResults.length ? 'Results available' : 'Awaiting results'}</span>
          <button type="button" aria-label={`${row.title} View results`} onClick={() => setSelectedId(row.id)}>View results</button>
        </footer>
      </article>;
    })}</div>
    {selectedId != null ? <dialog ref={dialog} className={styles.resultDialog} aria-label="Mock exam results" onClose={() => setSelectedId(null)}><button type="button" className={styles.close} aria-label="Close results" onClick={() => setSelectedId(null)}><X size={20}/></button><section className={styles.detail} aria-label="Mock exam results">
      {detail.isPending ? <p role="status">Loading results…</p> : null}
      {detail.isError ? <div role="alert"><p>{getApiErrorMessage(detail.error, 'Results are not available.')}</p><button onClick={() => void detail.refetch()}>Retry results</button></div> : null}
      {exam ? <><h3>{exam.title || 'Mock exam results'}</h3><p>{exam.status || exam.attempt?.status || 'Status unavailable'}</p><dl>
        {exam.listeningSelected ? <div><dt>Listening</dt><dd>{exam.listeningCorrect == null ? 'Awaiting submission' : `${exam.listeningCorrect} / ${exam.listeningTotal ?? '—'}`}</dd></div> : null}
        {exam.readingSelected ? <div><dt>Reading</dt><dd>{exam.readingCorrect == null ? 'Awaiting submission' : `${exam.readingCorrect} / ${exam.readingTotal ?? '—'}`}</dd></div> : null}
        {exam.writingSelected ? <div><dt>Writing</dt><dd>{exam.writingScore ?? 'Awaiting grade'}{exam.writingGradeStatus ? ` · ${exam.writingGradeStatus}` : ''}</dd></div> : null}
      </dl></> : null}
    </section></dialog> : null}
    {allRows.length > PAGE_SIZE ? <nav className={styles.paging} aria-label="Assigned paper pages"><button disabled={page === 0 || list.isFetching} onClick={() => {setPage(current => current - 1); setSelectedId(null);}}>Previous</button><span>Page {page + 1}</span><button disabled={(page + 1) * PAGE_SIZE >= allRows.length || list.isFetching} onClick={() => {setPage(current => current + 1); setSelectedId(null);}}>Next</button></nav> : null}
  </div>;
};
