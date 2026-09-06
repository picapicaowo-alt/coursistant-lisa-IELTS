import { useTranslation } from 'react-i18next';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {CalendarDays, ClipboardCheck, FileCheck2, X} from 'lucide-react';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {getApiErrorMessage} from '@/utils/apiError';
import {formatUtcTimestamp} from '@/utils/datetime';
import {normalizeStudentExams} from '@/utils/mockExamSummary';
import {formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import styles from './index.module.scss';

const PAGE_SIZE = 20;

/** Observer detail stays in the current role; it never links to a student attempt. */
export const ObserverMockExams = ({scope, studentUserId, onCountChange, emptyState}: {scope: 'advisor' | 'parent'; studentUserId: number; onCountChange?: (count: number | undefined) => void; emptyState?: ReactNode}) => {
  const { t: translate } = useTranslation();
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
    {list.isPending ? <p role="status">{translate('exams:loadingAssigned')}</p> : null}
    {list.isError ? <div role="alert"><p>{getApiErrorMessage(list.error, translate('exams:loadAssignedError'))}</p><button onClick={() => void list.refetch()}>{translate("common:actions.retry")}</button></div> : null}
    {list.isSuccess && rows.length === 0 ? emptyState ?? <p>{translate('exams:noneAssigned')}</p> : null}
    <div className={styles.paperGrid}>{rows.map(row => {
      const sectionResults = row.sections.filter(section => row.results[section]);
      return <article className={styles.record} key={row.id}>
        <header className={styles.recordHeader}>
          <span className={styles.examIcon}><ClipboardCheck size={22} aria-hidden="true"/></span>
          <span className={styles.status}>{statusLabel(row.attemptStatus || row.status)}</span>
        </header>
        <div className={styles.recordTitle}>
          <h3>{row.title}</h3>
          <p>{row.label}</p>
        </div>
        <dl className={styles.examFacts}>
          <div>
            <dt><FileCheck2 size={15} aria-hidden="true"/>{translate('exams:sections')}</dt>
            <dd>{row.sections.length ? row.sections.map(section => statusLabel(section)).join(' · ') : translate('common:feedback.notProvided')}</dd>
          </div>
          <div>
            <dt><CalendarDays size={15} aria-hidden="true"/>{translate("common:status.ASSIGNED")}</dt>
            <dd>{row.assignedAt ? <time dateTime={row.assignedAt}>{formatUtcTimestamp(row.assignedAt, {month: 'short', day: 'numeric', year: 'numeric'})}</time> : translate('common:feedback.notProvided')}</dd>
          </div>
        </dl>
        {sectionResults.length ? <dl className={styles.scoreStrip} aria-label={translate('exams:releasedSections')}>
          {sectionResults.map(section => <div key={section}><dt>{statusLabel(section)}</dt><dd>{row.results[section]}</dd></div>)}
        </dl> : null}
        <footer className={styles.recordFooter}>
          <span>{sectionResults.length ? translate('exams:resultsAvailable') : translate('exams:awaitingResults')}</span>
          <button type="button" aria-label={translate('exams:viewExamResults', {title: row.title})} onClick={() => setSelectedId(row.id)}>{translate('exams:viewResults')}</button>
        </footer>
      </article>;
    })}</div>
    {selectedId != null ? <dialog ref={dialog} className={styles.resultDialog} aria-label={translate('exams:results')} onClose={() => setSelectedId(null)}><button type="button" className={styles.close} aria-label={translate('exams:closeResults')} onClick={() => setSelectedId(null)}><X size={20}/></button><section className={styles.detail} aria-label={translate('exams:results')}>
      {detail.isPending ? <p role="status">{translate('exams:loadingResults')}</p> : null}
      {detail.isError ? <div role="alert"><p>{getApiErrorMessage(detail.error, translate('exams:resultsError'))}</p><button onClick={() => void detail.refetch()}>{translate('exams:retryResults')}</button></div> : null}
      {exam ? <><h3>{exam.title || translate('exams:results')}</h3><p>{statusLabel(exam.status || exam.attempt?.status || 'UNKNOWN')}</p><dl>
        {exam.listeningSelected ? <div><dt>{translate("common:status.LISTENING")}</dt><dd>{exam.listeningCorrect == null ? translate("common:status.AWAITING_SUBMISSION") : translate('exams:correctCount', {correct: formatNumber(exam.listeningCorrect), total: exam.listeningTotal == null ? '—' : formatNumber(exam.listeningTotal)})}</dd></div> : null}
        {exam.readingSelected ? <div><dt>{translate("common:status.READING")}</dt><dd>{exam.readingCorrect == null ? translate("common:status.AWAITING_SUBMISSION") : translate('exams:correctCount', {correct: formatNumber(exam.readingCorrect), total: exam.readingTotal == null ? '—' : formatNumber(exam.readingTotal)})}</dd></div> : null}
        {exam.writingSelected ? <div><dt>{translate("common:status.WRITING")}</dt><dd>{exam.writingScore == null ? translate('common:status.AWAITING_GRADE') : formatNumber(exam.writingScore)}{exam.writingGradeStatus ? ` · ${statusLabel(exam.writingGradeStatus)}` : ''}</dd></div> : null}
      </dl></> : null}
    </section></dialog> : null}
    {allRows.length > PAGE_SIZE ? <nav className={styles.paging} aria-label={translate('exams:pages')}><button disabled={page === 0 || list.isFetching} onClick={() => {setPage(current => current - 1); setSelectedId(null);}}>{translate("common:actions.previous")}</button><span>{translate('common:pagination.page', {page: formatNumber(page + 1)})}</span><button disabled={(page + 1) * PAGE_SIZE >= allRows.length || list.isFetching} onClick={() => {setPage(current => current + 1); setSelectedId(null);}}>{translate("common:actions.next")}</button></nav> : null}
  </div>;
};
