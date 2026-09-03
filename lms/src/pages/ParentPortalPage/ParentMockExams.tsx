import {useState} from 'react';
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  Headphones,
  PenLine,
  X,
  type LucideIcon,
} from 'lucide-react';
import {useQuery} from '@tanstack/react-query';
import {unwrapData, type ObserverMockExamDetail} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {AdvisingBadge} from '@/components/AdvisingBadge';
import {normalizeStudentExams, type StudentExamSummary} from '@/utils/mockExamSummary';
import {formatUtcTimestamp} from '@/utils/datetime';
import {getApiErrorMessage} from '@/utils/apiError';
import {parentLabel} from './parentPresentation';
import styles from './index.module.scss';
import shared from '../advising/advising.module.scss';

const PAGE_SIZE = 20;
const examDate = (value?: string | null): string | undefined => value ? formatUtcTimestamp(value, {month: 'short', day: 'numeric', year: 'numeric'}) : undefined;

function ExamResult({icon: Icon, label, value, total}: {icon: LucideIcon; label: string; value?: number; total?: number}) {
  const percentage = value != null && total != null && total > 0 ? Math.min(100, Math.max(0, value / total * 100)) : undefined;
  return <div className={styles.examResult}>
    <span className={styles.iconTile}><Icon size={22} aria-hidden="true"/></span>
    <div>
      <div><strong>{label}</strong><span>{value == null ? 'Awaiting result' : total == null ? value : <>{value} <small>/ {total} correct</small></>}</span></div>
      {percentage != null ? <><progress aria-label={`${label} score`} value={percentage} max={100}/><small>{Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%</small></> : null}
    </div>
  </div>;
}

function ExamListRow({row, selected, onSelect}: {row: StudentExamSummary; selected: boolean; onSelect: () => void}) {
  const status = row.attemptStatus || row.status;
  return <button type="button" className={styles.examRow} data-selected={selected || undefined} aria-pressed={selected} aria-label={`${row.title} View results`} onClick={onSelect}>
    <span className={styles.iconTile}><ClipboardCheck size={20} aria-hidden="true"/></span>
    <span><strong>{row.title}</strong><small>{[examDate(row.assignedAt), parentLabel(status)].filter(Boolean).join(' · ')}</small></span>
  </button>;
}

export function ParentMockExams({studentUserId}: {studentUserId: number}) {
  // undefined means select the first available exam; null is an intentional closed detail.
  const [selection, setSelection] = useState<number | null | undefined>(undefined);
  const [page, setPage] = useState(0);
  const list = useQuery({
    queryKey: ['mock-exams', 'parent', 'student', studentUserId],
    queryFn: async () => unwrapData(await mockExamApiService.listParentStudentExams(studentUserId), 'parentMockExams'),
    retry: false,
  });
  const allRows = normalizeStudentExams(list.data);
  const rows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedId = selection === undefined ? rows[0]?.id ?? null : selection;
  const detail = useQuery({
    queryKey: ['mock-exams', 'parent', 'student', studentUserId, 'detail', selectedId],
    queryFn: async () => unwrapData(await mockExamApiService.getParentStudentExam(studentUserId, selectedId!), 'parentMockExamDetail'),
    enabled: selectedId != null,
    retry: false,
  });
  const exam: ObserverMockExamDetail | undefined = detail.data;
  const status = exam?.attempt?.status || exam?.status;
  const submitted = examDate(exam?.attempt?.submittedAt || exam?.createdAt);
  return <div className={styles.examGrid}>
    <WorkspaceSection title="Assigned mock exams" count={allRows.length} className={styles.examList}>
      {list.isPending ? <p role="status">Loading assigned mock exams…</p> : null}
      {list.isError ? <div role="alert" className={shared.conflictNotice}><p>{getApiErrorMessage(list.error, 'Assigned mock exams could not be loaded.')}</p><button type="button" className={shared.secondary} onClick={() => void list.refetch()}>Retry</button></div> : null}
      {list.isSuccess && rows.length === 0 ? <div className={shared.emptyState}><ClipboardCheck size={42} aria-hidden="true"/><strong>No assigned mock exams</strong><span>Assigned papers and published results will appear here.</span></div> : null}
      {rows.length ? <div className={styles.examRows}>{rows.map(row => <ExamListRow key={row.id} row={row} selected={selectedId === row.id} onSelect={() => setSelection(row.id)}/>)}</div> : null}
      {allRows.length > PAGE_SIZE ? <nav className={styles.compactPagination} aria-label="Assigned mock exam pages"><button type="button" disabled={page === 0 || list.isFetching} onClick={() => {setPage(current => current - 1); setSelection(undefined);}}>Previous</button><span>Page {page + 1}</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= allRows.length || list.isFetching} onClick={() => {setPage(current => current + 1); setSelection(undefined);}}>Next</button></nav> : null}
    </WorkspaceSection>
    <WorkspaceSection title="Assessment results" className={styles.examDetail} meta={selectedId != null ? <button type="button" className={styles.iconButton} aria-label="Close results" onClick={() => setSelection(null)}><X size={18} aria-hidden="true"/></button> : null}>
      {detail.isPending ? <p role="status">Loading results…</p> : null}
      {detail.isError ? <div role="alert" className={shared.conflictNotice}><p>{getApiErrorMessage(detail.error, 'Results are not available.')}</p><button type="button" className={shared.secondary} onClick={() => void detail.refetch()}>Retry results</button></div> : null}
      {selectedId == null && !detail.isPending ? <div className={`${shared.emptyState} ${styles.detailEmpty}`}><FileCheck2 size={48} aria-hidden="true"/><strong>Select a mock exam</strong><span>Choose an assigned exam to review its published results.</span></div> : null}
      {exam ? <article className={styles.examArticle}>
        <header>
          <span className={styles.examHeroIcon}><ClipboardCheck size={28} aria-hidden="true"/></span>
          <div><h3>{exam.title || 'Mock exam results'}</h3>{submitted ? <p><CalendarDays size={16} aria-hidden="true"/>Submitted {submitted}</p> : null}</div>
          {status ? <AdvisingBadge kind="status" value={status} label={parentLabel(status)}/> : null}
        </header>
        <div className={styles.examResults}>
          {exam.listeningSelected ? <ExamResult icon={Headphones} label="Listening" value={exam.listeningCorrect} total={exam.listeningTotal}/> : null}
          {exam.readingSelected ? <ExamResult icon={BookOpen} label="Reading" value={exam.readingCorrect} total={exam.readingTotal}/> : null}
          {exam.writingSelected ? <div className={styles.examResult}>
            <span className={styles.iconTile}><PenLine size={22} aria-hidden="true"/></span>
            <div><div><strong>Writing</strong><span>{exam.writingScore ?? 'Awaiting grade'}{exam.writingGradeStatus ? <small>{parentLabel(exam.writingGradeStatus)}</small> : null}</span></div></div>
          </div> : null}
          {!exam.listeningSelected && !exam.readingSelected && !exam.writingSelected ? <p className={styles.meta}>No published section results are available yet.</p> : null}
        </div>
      </article> : null}
    </WorkspaceSection>
  </div>;
}
