import {ADVISOR_PAGE_SIZE, ADVISOR_RISKS, ACTION_TASK_TYPES, type AdvisorStudentFilters} from '@/apis/types/advisorWorkspace';
import React, {useState} from 'react';
import {Link, generatePath} from 'react-router-dom';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {formatUtcTimestamp} from '@/utils/datetime';
import listStyles from './index.module.scss';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';

const RISK_LABELS: Record<string, string> = {ON_TRACK: 'On track', AT_RISK: 'At risk', NEEDS_ATTENTION: 'Needs attention'};

const AdvisorStudentsPage: React.FC = () => {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<AdvisorStudentFilters>({});
  const query = useQuery({
    queryKey: [...advisingQueryKeys.advisorStudents(page, ADVISOR_PAGE_SIZE), filters],
    queryFn: async () => unwrapData(await advisorApiService.listStudents(page, ADVISOR_PAGE_SIZE, filters), 'listAdvisorStudents'),
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADVISOR_PAGE_SIZE));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>

          <h1>Students</h1>
          <p className={styles.lede}>Track the goals and progress of your assigned students.</p>
        </div>
      </header>
      <section className={listStyles.panel} aria-label="Assigned students">
        <div className={listStyles.panelHeading}><h2>Student information</h2><span>{query.isPending ? 'Loading…' : `${total} students`}</span></div>
      <div className={`${styles.form} ${listStyles.filters}`} role="search" aria-label="Student filters">
        <label>Search students<input type="search" placeholder="Search by name or email" maxLength={100} value={filters.q ?? ''} onChange={event => {setFilters(current => ({...current, q: event.target.value || undefined})); setPage(0);}}/></label>
        <label>Risk<select value={filters.risk ?? ''} onChange={event => {setFilters(current => ({...current, risk: event.target.value as AdvisorStudentFilters['risk'] || undefined})); setPage(0);}}><option value="">All risks</option>{ADVISOR_RISKS.map(risk => <option key={risk}>{risk}</option>)}</select></label>
        <label>Student type<select value={filters.studentType ?? ''} onChange={event => {setFilters(current => ({...current, studentType: event.target.value as AdvisorStudentFilters['studentType'] || undefined})); setPage(0);}}><option value="">All types</option><option>VIP</option><option>STANDARD</option></select></label>
        <label>Active task<select value={filters.activeTaskType ?? ''} onChange={event => {setFilters(current => ({...current, activeTaskType: event.target.value || undefined})); setPage(0);}}><option value="">All tasks</option>{ACTION_TASK_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
      </div>
      {query.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(query.error, 'Students could not be loaded.')}</p> : null}
      {query.isPending ? <p className={styles.status}>Loading students…</p> : null}
      {!query.isPending && !query.isError && items.length === 0 ? <p className={styles.status}>{Object.values(filters).some(Boolean) ? 'No students match these filters.' : 'No assigned students yet.'}</p> : null}
      {!query.isPending && !query.isError && items.length > 0 ? <table className={listStyles.table}>
        <caption className={listStyles.srOnly}>Assigned students and current progress</caption>
        <thead><tr><th scope="col">Student</th><th scope="col">Target goal</th><th scope="col">Risk</th><th scope="col">Last activity</th><th scope="col"><span className={listStyles.srOnly}>Actions</span></th></tr></thead>
        <tbody>{items.map(student => {
          const name = formatPersonName(student, `Student #${student.studentUserId}`);
          return <tr key={student.studentUserId}>
            <th scope="row"><div className={listStyles.studentIdentity}><span className={listStyles.avatar} aria-hidden="true">{[student.firstName, student.lastName].map(part => part?.charAt(0)).join('')}</span><div><strong>{name}</strong><span>{student.email}</span><small>{student.studentType === 'VIP' ? 'VIP' : 'Standard'} · Student #{student.studentUserId}</small></div></div></th>
            <td data-label="Target goal">{student.targetGoal || 'Not set'}</td>
            <td data-label="Risk"><span className={listStyles.risk} data-status={student.riskStatus}>{student.riskStatus ? (RISK_LABELS[student.riskStatus] ?? student.riskStatus) : 'Not assessed'}</span></td>
            <td data-label="Last activity">{student.lastActivityAt ? formatUtcTimestamp(student.lastActivityAt) : 'No activity recorded'}</td>
            <td className={listStyles.action}><Link className={listStyles.open} aria-label={`Open ${name}`} to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdIntake, {studentUserId: String(student.studentUserId)})}>Open<span aria-hidden="true">›</span></Link></td>
          </tr>;
        })}</tbody>
      </table> : null}
      {pageCount > 1 ? (
        <nav className={styles.pagination} aria-label="Student pages">
          <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>{page + 1} / {pageCount}</span>
          <button type="button" className={styles.secondary} disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      ) : null}
      </section>
    </div>
  );
};

export default AdvisorStudentsPage;
