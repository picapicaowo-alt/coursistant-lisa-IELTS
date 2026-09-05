import {formatNumber, getFormattingLocale} from '@/i18n/formatting';
import { useTranslation } from 'react-i18next';
import {useEffect, useId, useRef, useState} from 'react';
import {ArrowDown, ChevronLeft, ChevronRight, X} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';
import type {CheckpointResponse} from '@/apis/types/advising';
import {
  formatPlanDate, STUDY_PLAN_PARAMS, studyPlanRecordKey, TASK_PAGE_SIZES,
  TASK_STATUS, TASK_SUBMISSION_MAX_LENGTH, taskStatusLabel, taskStatusTone, type TaskInteractionProps,
} from './studyPlanView';
import styles from './CheckpointWorkspace.module.scss';

type Sort = {field: 'deadline' | 'status'; direction: 1 | -1};

export function CheckpointWorkspace({checkpoint, index, onBack, ...interaction}: {
  checkpoint: CheckpointResponse; index: number; onBack: () => void;
} & TaskInteractionProps) {
  const { t: translate } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<Sort | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(TASK_PAGE_SIZES[0]);
  const overviewHeading = useRef<HTMLHeadingElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const returnTarget = useRef<HTMLButtonElement | null>(null);
  const detailId = useId();
  const noteId = useId();
  const rows = (checkpoint.tasks ?? []).map((task, taskIndex) => ({task, key: studyPlanRecordKey(task, taskIndex)}));
  const taskKey = params.get(STUDY_PLAN_PARAMS.task);
  const selected = rows.find(row => row.key === taskKey);
  const filteredRows = rows.filter(({task}) => !filter || task.status === filter);
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sort) return 0;
    if (sort.field === 'deadline') {
      if (!a.task.dueDate) return b.task.dueDate ? 1 : 0;
      if (!b.task.dueDate) return -1;
      return a.task.dueDate.localeCompare(b.task.dueDate) * sort.direction;
    }
    return taskStatusLabel(a.task.status).localeCompare(taskStatusLabel(b.task.status), getFormattingLocale()) * sort.direction;
  });
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  useEffect(() => {
    if (taskKey) detailHeading.current?.focus({preventScroll: true});
    else {
      // Restore the trigger after React commits the panel removal. A scheduled
      // animation frame can race the heading effect and lose keyboard focus.
      const target = returnTarget.current?.isConnected ? returnTarget.current : overviewHeading.current;
      target?.focus({preventScroll: true});
    }
  }, [taskKey]);

  const closeDetail = () => {
    const next = new URLSearchParams(params);
    next.delete(STUDY_PLAN_PARAMS.task);
    setParams(next);
    interaction.onClearError();
  };
  const openDetail = (key: string, button: HTMLButtonElement) => {
    returnTarget.current = button;
    const next = new URLSearchParams(params);
    next.set(STUDY_PLAN_PARAMS.task, key);
    setParams(next);
    interaction.onClearError();
  };
  const changeSort = (field: Sort['field']) => {
    setSort(current => ({field, direction: current?.field === field && current.direction === 1 ? -1 : 1}));
    setPage(0);
  };
  const task = selected?.task;
  const canAct = task?.id != null && task.version != null && [TASK_STATUS.notStarted, TASK_STATUS.inProgress].some(status => status === task.status);

  return <section className={styles.workspace} aria-label={translate("learning:checkpoint.workspace")} data-figma-node="464:3172" onKeyDown={event => {
    if (event.key === 'Escape' && taskKey) { event.stopPropagation(); closeDetail(); }
  }}>
    <header className={styles.topbar}>
      <button type="button" className={styles.back} onClick={onBack}>{translate("common:navigationControls.backToStudyPlan")}</button>
    </header>
    <div className={`${styles.columns} ${taskKey ? styles.withDetail : ''}`}>
      <div className={styles.main}>
        <header className={styles.overview}>
          <div className={styles.phaseCopy}>
            <span className={styles.phase}>{translate('advising:studentTasks.checkpoint', {number: formatNumber(index + 1, {minimumIntegerDigits: 2})})}</span>
            <h1 ref={overviewHeading} tabIndex={-1}>{checkpoint.description || translate("learning:checkpoint.checkpoint")}</h1>
            {checkpoint.goal ? <p>{checkpoint.goal}</p> : null}
          </div>
          <img className={styles.illustration} src="/icons/figma-study-plan/celebration.svg" alt=""/>
          <div className={styles.statistics} aria-label={translate("learning:checkpoint.filters")}>
            {[{status: '', label: translate("advising:studentTasks.allTasks")}, {status: TASK_STATUS.inProgress, label: translate("common:status.inProgress")}, {status: TASK_STATUS.completed, label: translate("common:status.COMPLETED")}, {status: TASK_STATUS.notStarted, label: translate("common:status.NOT_STARTED")}].map(item => <button type="button" key={item.status} className={styles.statistic} aria-pressed={filter === item.status} onClick={() => {setFilter(item.status); setPage(0);}}>
              {item.status ? <span aria-hidden="true" className={`${styles.dot} ${styles[taskStatusTone(item.status)]}`}/> : null}
              <span>{item.label}</span><strong>{formatNumber(item.status ? rows.filter(({task: row}) => row.status === item.status).length : rows.length)}</strong>
            </button>)}
          </div>
        </header>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>{translate('learning:checkpoint.tasksFor', {checkpoint: checkpoint.description || translate('learning:checkpoint.current')})}</caption>
            <thead><tr>
              <th scope="col">{translate("learning:checkpoint.taskName")}</th>
              <th scope="col" aria-sort={sort?.field === 'deadline' ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => changeSort('deadline')}>{translate("learning:checkpoint.deadline")}<ArrowDown size={14} aria-hidden="true"/></button></th>
              <th scope="col" aria-sort={sort?.field === 'status' ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => changeSort('status')}>{translate("common:fields.status")}<ArrowDown size={14} aria-hidden="true"/></button></th>
              <th scope="col"><span className={styles.srOnly}>{translate("common:fields.details")}</span></th>
            </tr></thead>
            <tbody>{visibleRows.map(row => <tr key={row.key} className={selected?.key === row.key ? styles.selected : undefined}>
              <th scope="row"><strong>{row.task.title || translate("advising:studentTasks.task")}</strong>{row.task.description ? <span className={styles.taskDescription}>{row.task.description}</span> : null}</th>
              <td><span className={styles.date}><img src="/icons/figma-study-plan/calendar.svg" alt=""/>{formatPlanDate(row.task.dueDate)}</span></td>
              <td><span className={`${styles.status} ${styles[taskStatusTone(row.task.status)]}`}>{taskStatusLabel(row.task.status)}</span></td>
              <td><button type="button" className={styles.view} aria-label={translate('learning:checkpoint.viewTask', {task: row.task.title || translate('advising:studentTasks.task')})} aria-expanded={selected?.key === row.key} aria-controls={selected?.key === row.key ? detailId : undefined} onClick={event => openDetail(row.key, event.currentTarget)}>{translate("common:actions.view")}</button></td>
            </tr>)}</tbody>
          </table>
          {visibleRows.length === 0 ? <p className={styles.empty}>{rows.length ? translate("learning:checkpoint.noMatches") : translate("learning:checkpoint.noTasks")}</p> : null}
        </div>
        {rows.length > 0 ? <nav className={styles.pagination} aria-label={translate("learning:checkpoint.pages")}>
          <div className={styles.pageControls}>
            <button type="button" aria-label={translate('common:navigationControls.previousTaskPage')} title={translate('common:navigationControls.previousTaskPage')} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} aria-hidden="true"/></button>
            <span aria-live="polite">{translate('common:pagination.pageOf', {page: formatNumber(currentPage + 1), total: formatNumber(pageCount)})}</span>
            <button type="button" aria-label={translate('common:navigationControls.nextTaskPage')} title={translate('common:navigationControls.nextTaskPage')} disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} aria-hidden="true"/></button>
          </div>
          <label>{translate("learning:checkpoint.rowsPerPage")}<select value={pageSize} onChange={event => {setPageSize(Number(event.target.value)); setPage(0);}}>{TASK_PAGE_SIZES.map(size => <option value={size} key={size}>{formatNumber(size)}</option>)}</select></label>
        </nav> : null}
      </div>
      {taskKey ? <aside className={styles.detail} id={detailId} aria-labelledby={`${detailId}-heading`}>
        <button type="button" className={styles.close} aria-label={translate("learning:checkpoint.close")} onClick={closeDetail}><X size={20}/></button>
        <h2 id={`${detailId}-heading`} ref={detailHeading} tabIndex={-1}>{task?.title || (selected ? translate("advising:studentTasks.task") : translate("learning:checkpoint.unavailable"))}</h2>
        {task ? <>
          <div className={styles.detailMeta}><span className={styles.date}><img src="/icons/figma-study-plan/calendar.svg" alt=""/>{formatPlanDate(task.dueDate)}</span><span className={`${styles.status} ${styles[taskStatusTone(task.status)]}`}>{taskStatusLabel(task.status)}</span></div>
          <div className={styles.detailCopy}>{task.description ? <p>{task.description}</p> : <p>{translate("learning:checkpoint.noDescription")}</p>}
            {task.submissionRequirement ? <section><h3>{translate("learning:checkpoint.requirement")}</h3><p>{task.submissionRequirement}</p></section> : null}
            {task.advisorFeedback ? <section><h3>{translate("learning:checkpoint.feedback")}</h3><p>{task.advisorFeedback}</p></section> : null}
          </div>
          <div className={styles.submission}>
            {canAct && task.id != null ? <>
              <label htmlFor={noteId}>{translate("learning:checkpoint.note")}</label><textarea id={noteId} value={interaction.submissions[task.id] ?? task.submissionText ?? ''} onChange={event => interaction.onSubmission(task.id!, event.target.value)} rows={4} maxLength={TASK_SUBMISSION_MAX_LENGTH} placeholder={translate("learning:checkpoint.placeholder")}/>
              {interaction.error && interaction.actionTaskId === task.id ? <p className={styles.error} role="alert">{interaction.error}</p> : null}
              <div className={styles.actions}>
                {task.status === TASK_STATUS.notStarted ? <button type="button" className={styles.secondary} disabled={interaction.isPending} onClick={() => interaction.onAction({action: 'start', taskId: task.id!, version: task.version!})}>{translate("learning:checkpoint.start")}</button> : null}
                <button type="button" className={styles.primary} disabled={interaction.isPending} onClick={() => interaction.onAction({action: 'complete', taskId: task.id!, version: task.version!})}>{interaction.isPending ? translate("common:actions.saving") : translate("learning:checkpoint.complete")}</button>
              </div>
            </> : task.submissionText ? <section><h3>{translate("assessment:submission.yourSubmission")}</h3><p>{task.submissionText}</p></section> : null}
          </div>
        </> : <p>{translate("learning:checkpoint.gone")}</p>}
      </aside> : null}
    </div>
  </section>;
}
