import { useTranslation } from 'react-i18next';
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
import {statusLabel} from '@/i18n/presentation';
import {formatNumber, formatPercent} from '@/i18n/formatting';
import styles from './index.module.scss';
import shared from '../advising/advising.module.scss';

const PAGE_SIZE = 20;
const examDate = (value?: string | null): string | undefined => value ? formatUtcTimestamp(value, {month: 'short', day: 'numeric', year: 'numeric'}) : undefined;

function ExamResult({icon: Icon, label, value, total}: {icon: LucideIcon; label: string; value?: number; total?: number}) {
  const {t: translate} = useTranslation();
  const percentage = value != null && total != null && total > 0 ? Math.min(100, Math.max(0, value / total * 100)) : undefined;
  return <div className={styles.examResult}>
    <span className={styles.iconTile}><Icon size={22} aria-hidden="true"/></span>
    <div>
      <div><strong>{label}</strong><span>{value == null ? translate('exams:awaitingResults') : total == null ? formatNumber(value) : translate('exams:correctCount', {correct: formatNumber(value), total: formatNumber(total)})}</span></div>
      {percentage != null ? <><progress aria-label={translate('exams:scoreLabel', {section: label})} value={percentage} max={100}/><small>{formatPercent(percentage / 100, {maximumFractionDigits: 1})}</small></> : null}
    </div>
  </div>;
}

function ExamListRow({row, selected, onSelect}: {row: StudentExamSummary; selected: boolean; onSelect: () => void}) {
  const {t: translate} = useTranslation();
  const status = row.attemptStatus || row.status;
  return <button type="button" className={styles.examRow} data-selected={selected || undefined} aria-pressed={selected} aria-label={translate('exams:viewExamResults', {title: row.title})} onClick={onSelect}>
    <span className={styles.iconTile}><ClipboardCheck size={20} aria-hidden="true"/></span>
    <span><strong>{row.title}</strong><small>{[examDate(row.assignedAt), statusLabel(status)].filter(Boolean).join(' · ')}</small></span>
  </button>;
}

export function ParentMockExams({studentUserId}: {studentUserId: number}) {
  const { t: translate } = useTranslation();
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
    <WorkspaceSection title={translate('exams:assigned')} count={allRows.length} className={styles.examList}>
      {list.isPending ? <p role="status">{translate('exams:loadingAssigned')}</p> : null}
      {list.isError ? <div role="alert" className={shared.conflictNotice}><p>{getApiErrorMessage(list.error, translate('exams:loadAssignedError'))}</p><button type="button" className={shared.secondary} onClick={() => void list.refetch()}>{translate("common:actions.retry")}</button></div> : null}
      {list.isSuccess && rows.length === 0 ? <div className={shared.emptyState}><ClipboardCheck size={42} aria-hidden="true"/><strong>{translate('exams:noneAssigned')}</strong><span>{translate('exams:noneAssignedHelp')}</span></div> : null}
      {rows.length ? <div className={styles.examRows}>{rows.map(row => <ExamListRow key={row.id} row={row} selected={selectedId === row.id} onSelect={() => setSelection(row.id)}/>)}</div> : null}
      {allRows.length > PAGE_SIZE ? <nav className={styles.compactPagination} aria-label={translate('exams:pages')}><button type="button" disabled={page === 0 || list.isFetching} onClick={() => {setPage(current => current - 1); setSelection(undefined);}}>{translate("common:actions.previous")}</button><span>{translate('common:pagination.page', {page: formatNumber(page + 1)})}</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= allRows.length || list.isFetching} onClick={() => {setPage(current => current + 1); setSelection(undefined);}}>{translate("common:actions.next")}</button></nav> : null}
    </WorkspaceSection>
    <WorkspaceSection title={translate('exams:assessmentResults')} className={styles.examDetail} meta={selectedId != null ? <button type="button" className={styles.iconButton} aria-label={translate('exams:closeResults')} onClick={() => setSelection(null)}><X size={18} aria-hidden="true"/></button> : null}>
      {selectedId != null && detail.isPending ? <p role="status">{translate('exams:loadingResults')}</p> : null}
      {detail.isError ? <div role="alert" className={shared.conflictNotice}><p>{getApiErrorMessage(detail.error, translate('exams:resultsError'))}</p><button type="button" className={shared.secondary} onClick={() => void detail.refetch()}>{translate('exams:retryResults')}</button></div> : null}
      {selectedId == null ? <div className={`${shared.emptyState} ${styles.detailEmpty}`}><FileCheck2 size={48} aria-hidden="true"/><strong>{translate('exams:selectExam')}</strong><span>{translate('exams:selectExamHelp')}</span></div> : null}
      {exam ? <article className={styles.examArticle}>
        <header>
          <span className={styles.examHeroIcon}><ClipboardCheck size={28} aria-hidden="true"/></span>
          <div><h3>{exam.title || translate('exams:results')}</h3>{submitted ? <p><CalendarDays size={16} aria-hidden="true"/>{translate('common:records.submittedAt', {date: submitted})}</p> : null}</div>
          {status ? <AdvisingBadge kind="status" value={status} label={statusLabel(status)}/> : null}
        </header>
        <div className={styles.examResults}>
          {exam.listeningSelected ? <ExamResult icon={Headphones} label={translate("common:status.LISTENING")} value={exam.listeningCorrect} total={exam.listeningTotal}/> : null}
          {exam.readingSelected ? <ExamResult icon={BookOpen} label={translate("common:status.READING")} value={exam.readingCorrect} total={exam.readingTotal}/> : null}
          {exam.writingSelected ? <div className={styles.examResult}>
            <span className={styles.iconTile}><PenLine size={22} aria-hidden="true"/></span>
            <div><div><strong>{translate("common:status.WRITING")}</strong><span>{exam.writingScore == null ? translate('common:status.AWAITING_GRADE') : formatNumber(exam.writingScore)}{exam.writingGradeStatus ? <small>{statusLabel(exam.writingGradeStatus)}</small> : null}</span></div></div>
          </div> : null}
          {!exam.listeningSelected && !exam.readingSelected && !exam.writingSelected ? <p className={styles.meta}>{translate('exams:noSectionResults')}</p> : null}
        </div>
      </article> : null}
    </WorkspaceSection>
  </div>;
}
