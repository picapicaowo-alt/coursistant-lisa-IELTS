import {useEffect, useRef, useState} from 'react';
import {ClipboardCheck, X} from 'lucide-react';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {getApiErrorMessage} from '@/utils/apiError';
import styles from './index.module.scss';

const PAGE_SIZE = 20;

const records = (value: unknown): Array<{id: number; title: string}> => {
  const items = Array.isArray(value) ? value : value && typeof value === 'object' && 'items' in value ? value.items : [];
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const id = 'studentMockExamId' in item ? item.studentMockExamId : 'id' in item ? item.id : undefined;
    if (typeof id !== 'number') return [];
    return [{id, title: 'title' in item && typeof item.title === 'string' ? item.title : `Mock exam #${id}`}];
  });
};

/** Observer detail stays in the current role; it never links to a student attempt. */
export const ObserverMockExams = ({scope, studentUserId}: {scope: 'advisor' | 'parent'; studentUserId: number}) => {
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
  const allRows = records(list.data);
  const rows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const exam = detail.data;
  useEffect(() => {if (selectedId != null) dialog.current?.showModal();}, [selectedId]);
  return <div className={styles.workspace}>
    {list.isPending ? <p role="status">Loading assigned papers…</p> : null}
    {list.isError ? <div role="alert"><p>{getApiErrorMessage(list.error, 'Assigned papers could not be loaded.')}</p><button onClick={() => void list.refetch()}>Retry</button></div> : null}
    {list.isSuccess && rows.length === 0 ? <p>No assigned mock exams.</p> : null}
    <div className={styles.paperGrid}>{rows.map(row => <button className={styles.record} aria-expanded={selectedId === row.id} key={row.id} onClick={() => setSelectedId(current => current === row.id ? null : row.id)}><ClipboardCheck size={28} aria-hidden="true"/><strong>{row.title}</strong><span>{selectedId === row.id ? 'Hide results' : 'View results'}</span></button>)}</div>
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
