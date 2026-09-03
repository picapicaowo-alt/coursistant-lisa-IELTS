import React, {useState} from 'react';
import {Link, generatePath} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
  Search,
  Calendar,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {unwrapData} from '@/apis';
import {AdvisingBadge} from '@/components/AdvisingBadge';
import {RISK_LABELS} from '@/components/AdvisingBadge/labels';
import {UserAvatar} from '@/components/UserAvatar';
import {advisorApiService} from '@/apis/services/advisor-api';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {formatUtcTimestamp} from '@/utils/datetime';
import {formatPersonName} from '@/utils/personName';
import {
  ADVISOR_PAGE_SIZE,
  ADVISOR_RISKS,
  ACTION_TASK_TYPES,
  type AdvisorStudentFilters,
} from '@/apis/types/advisorWorkspace';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import listStyles from './index.module.scss';

const AdvisorStudentsPage: React.FC = () => {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<AdvisorStudentFilters>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  const query = useQuery({
    queryKey: [...advisingQueryKeys.advisorStudents(page, ADVISOR_PAGE_SIZE), filters],
    queryFn: async () =>
      unwrapData(await advisorApiService.listStudents(page, ADVISOR_PAGE_SIZE, filters), 'listAdvisorStudents'),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADVISOR_PAGE_SIZE));

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === items.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(items.map(s => s.studentUserId));
    }
  };

  const toggleSelectStudent = (studentId: number) => {
    setSelectedStudentIds(current =>
      current.includes(studentId) ? current.filter(id => id !== studentId) : [...current, studentId]
    );
  };


  return (
    <div className={listStyles.page}>
      <header className={listStyles.header}>
        <div>
          <h1 aria-label="Students">Students</h1>
          <p className={listStyles.lede}>Manage and monitor all students assigned to you.</p>
        </div>
      </header>

      <section className={listStyles.panel} aria-label="Assigned students">
        <div className={listStyles.panelHeading}>
          <h2>Students Information</h2>
          <div className={listStyles.toolbar}>
            {/* Search Input */}
            <div className={listStyles.searchBox}>
              <Search className={listStyles.searchIcon} size={15} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search students…"
                aria-label="Search students"
                maxLength={100}
                value={filters.q ?? ''}
                onChange={event => {
                  setFilters(current => ({...current, q: event.target.value || undefined}));
                  setPage(0);
                }}
              />
            </div>

            {/* Risk / State Filter */}
            <select
              className={listStyles.filterSelect}
              aria-label="Student risk"
              value={filters.risk ?? ''}
              onChange={event => {
                setFilters(current => ({
                  ...current,
                  risk: (event.target.value as AdvisorStudentFilters['risk']) || undefined,
                }));
                setPage(0);
              }}
            >
              <option value="">All state</option>
              {ADVISOR_RISKS.map(risk => (
                <option key={risk} value={risk}>
                  {RISK_LABELS[risk] || risk}
                </option>
              ))}
            </select>

            {/* Student Type Filter */}
            <select
              className={listStyles.filterSelect}
              aria-label="Student type"
              value={filters.studentType ?? ''}
              onChange={event => {
                setFilters(current => ({
                  ...current,
                  studentType: (event.target.value as AdvisorStudentFilters['studentType']) || undefined,
                }));
                setPage(0);
              }}
            >
              <option value="">All types</option>
              <option value="VIP">VIP</option>
              <option value="STANDARD">Standard</option>
            </select>

            {/* Active Task Filter */}
            <select
              className={listStyles.filterSelect}
              aria-label="Active task type"
              value={filters.activeTaskType ?? ''}
              onChange={event => {
                setFilters(current => ({
                  ...current,
                  activeTaskType: event.target.value || undefined,
                }));
                setPage(0);
              }}
            >
              <option value="">All tasks</option>
              {ACTION_TASK_TYPES.map(type => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {query.isError ? (
          <p className={styles.error} role="alert">
            {advisingErrorMessage(query.error, 'Students could not be loaded.')}
          </p>
        ) : null}
        {query.isPending ? <p className={styles.status}>Loading students…</p> : null}

        {!query.isPending && !query.isError && items.length === 0 ? (
          <p className={styles.status}>
            {Object.values(filters).some(Boolean)
              ? 'No students match these filters.'
              : 'No assigned students yet.'}
          </p>
        ) : null}

        {!query.isPending && !query.isError && items.length > 0 ? (
          <div className={listStyles.tableContainer}>
            <table className={listStyles.table}>
              <caption className={listStyles.srOnly}>Assigned students and current progress</caption>
              <thead>
                <tr>
                  <th scope="col" style={{width: '3.5rem'}}>
                    <input
                      type="checkbox"
                      className={listStyles.checkboxInput}
                      checked={items.length > 0 && selectedStudentIds.length === items.length}
                      onChange={toggleSelectAll}
                      aria-label="Select all students"
                    />
                  </th>
                  <th scope="col">Students Name</th>
                  <th scope="col">Target Goal</th>
                  <th scope="col">Current Level</th>
                  <th scope="col">Risk Level</th>
                  <th scope="col">Next Checkpoint</th>
                  <th scope="col">Last Activity</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(student => {
                  const name = formatPersonName(student, `Student #${student.studentUserId}`);
                  const isChecked = selectedStudentIds.includes(student.studentUserId);
                  const studentIdFormatted = `ID: ${student.studentUserId}`;

                  return (
                    <tr key={student.studentUserId}>
                      <td>
                        <input
                          type="checkbox"
                          className={listStyles.checkboxInput}
                          checked={isChecked}
                          onChange={() => toggleSelectStudent(student.studentUserId)}
                          aria-label={`Select ${name}`}
                        />
                      </td>
                      <th scope="row">
                        <div className={listStyles.studentCell}>
                          <UserAvatar userId={student.studentUserId} className={listStyles.avatar}/>
                          <div className={listStyles.nameCol}>
                            <strong>{name}</strong>
                            <small>{studentIdFormatted}</small>
                          </div>
                        </div>
                      </th>
                      <td data-label="Target goal" className={listStyles.targetScore}>
                        {student.targetGoal || 'Not set'}
                      </td>
                      <td data-label="Current level">
                        <span className={listStyles.levelCell}>Not available</span>
                      </td>
                      <td data-label="Risk level">
                        <AdvisingBadge value={student.highestPriority ?? student.riskStatus} kind={student.highestPriority ? "priority" : "risk"}/>
                      </td>
                      <td data-label="Next checkpoint">
                        <span className={listStyles.checkpointCell}>
                          <Calendar size={14} aria-hidden="true" />
                          <span>{'Not available'}</span>
                        </span>
                      </td>
                      <td data-label="Last activity" className={listStyles.activityCell}>
                        {student.lastActivityAt
                          ? formatUtcTimestamp(student.lastActivityAt)
                          : 'Not available'}
                      </td>
                      <td>
                        <div className={listStyles.actionCell}>
                          <Link
                            className={listStyles.viewBtn}
                            aria-label={`Open ${name}`}
                            to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdIntake, {
                              studentUserId: String(student.studentUserId),
                            })}
                          >
                            View
                          </Link>
                          <Link
                            className={listStyles.iconBtn}
                            aria-label={`Message ${name}`}
                            to={`${generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdSupport, {
                              studentUserId: String(student.studentUserId),
                            })}#conversation`}
                          >
                            <MessageSquare size={14} aria-hidden="true" />
                          </Link>

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Pagination Bar */}
        <div className={listStyles.paginationRow}>
          <span>
            Showing {total === 0 ? 0 : page * ADVISOR_PAGE_SIZE + 1} to{' '}
            {Math.min((page + 1) * ADVISOR_PAGE_SIZE, total)} of {total} students
          </span>

          <div className={listStyles.pagePills}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            {Array.from({length: pageCount}, (_, index) => (
              <button
                key={index}
                type="button"
                data-active={page === index ? 'true' : undefined}
                onClick={() => setPage(index)}
              >
                {index + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>

          <span>Lines per page: {ADVISOR_PAGE_SIZE}</span>
        </div>

        {selectedStudentIds.length > 0 ? <div className={listStyles.floatingSelectionBar}>
        <span>{selectedStudentIds.length} selected</span>
        <button type="button" onClick={() => setSelectedStudentIds([])}>Clear selection</button>
      </div> : null}
      </section>
    </div>
  );
};

export default AdvisorStudentsPage;
