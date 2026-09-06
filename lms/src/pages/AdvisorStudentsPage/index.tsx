import React, {useDeferredValue, useEffect, useState} from 'react';
import {Link, generatePath} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
  Search,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {unwrapData} from '@/apis';
import {AdvisingBadge} from '@/components/AdvisingBadge';
import {RISK_LABELS} from '@/components/AdvisingBadge/labels';
import {useTranslation} from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
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
import {advisorPaginationItems} from './pagination';

const AdvisorStudentsPage: React.FC = () => {
  const {t} = useTranslation();
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<AdvisorStudentFilters>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const deferredSearch = useDeferredValue(searchTerm.trim());
  const requestFilters: AdvisorStudentFilters = {
    ...filters,
    q: deferredSearch || undefined,
  };

  const query = useQuery({
    queryKey: [...advisingQueryKeys.advisorStudents(page, ADVISOR_PAGE_SIZE), requestFilters],
    queryFn: async () =>
      unwrapData(await advisorApiService.listStudents(page, ADVISOR_PAGE_SIZE, requestFilters), 'listAdvisorStudents'),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADVISOR_PAGE_SIZE));
  const paginationItems = advisorPaginationItems(page, pageCount);

  useEffect(() => {
    setSelectedStudentIds([]);
  }, [page, deferredSearch, filters.risk, filters.studentType, filters.activeTaskType]);

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
          <h1>{t("advising:students.title")}</h1>
          <p className={listStyles.lede}>{t("advising:students.description")}</p>
        </div>
      </header>

      <section className={listStyles.panel} aria-label={t("advising:overview.stats.assigned")}>
        <div className={listStyles.panelHeading}>
          <h2>{t("advising:students.information")}</h2>
          <div className={listStyles.toolbar}>
            {/* Search Input */}
            <div className={listStyles.searchBox}>
              <Search className={listStyles.searchIcon} size={15} aria-hidden="true" />
              <input
                type="search"
                placeholder={t("advising:students.searchPlaceholder")}
                aria-label={t("assessment:quizGrading.searchStudents")}
                maxLength={100}
                value={searchTerm}
                onChange={event => {
                  setSearchTerm(event.target.value);
                  setPage(0);
                }}
              />
            </div>

            {/* Risk / State Filter */}
            <select
              className={listStyles.filterSelect}
              aria-label={t("advising:students.risk")}
              value={filters.risk ?? ''}
              onChange={event => {
                setFilters(current => ({
                  ...current,
                  risk: (event.target.value as AdvisorStudentFilters['risk']) || undefined,
                }));
                setPage(0);
              }}
            >
              <option value="">{t("advising:students.allStates")}</option>
              {ADVISOR_RISKS.map(risk => (
                <option key={risk} value={risk}>
                  {RISK_LABELS[risk] ? t(RISK_LABELS[risk]) : risk}
                </option>
              ))}
            </select>

            {/* Student Type Filter */}
            <select
              className={listStyles.filterSelect}
              aria-label={t("advising:actionTasks.studentType")}
              value={filters.studentType ?? ''}
              onChange={event => {
                setFilters(current => ({
                  ...current,
                  studentType: (event.target.value as AdvisorStudentFilters['studentType']) || undefined,
                }));
                setPage(0);
              }}
            >
              <option value="">{t("advising:actionTasks.allTypes")}</option>
              <option value="VIP">{t("common:status.VIP")}</option>
              <option value="STANDARD">{t("common:status.STANDARD")}</option>
            </select>

            {/* Active Task Filter */}
            <select
              className={listStyles.filterSelect}
              aria-label={t("advising:students.activeTaskType")}
              value={filters.activeTaskType ?? ''}
              onChange={event => {
                setFilters(current => ({
                  ...current,
                  activeTaskType: event.target.value || undefined,
                }));
                setPage(0);
              }}
            >
              <option value="">{t("advising:studentTasks.allTasks")}</option>
              {ACTION_TASK_TYPES.map(type => (
                <option key={type} value={type}>
                  {statusLabel(type)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {query.isError ? (
          <p className={styles.error} role="alert">
            {advisingErrorMessage(query.error, t('advising:students.failed'))}{' '}<button type="button" onClick={() => void query.refetch()}>{t("common:actions.tryAgain")}</button>
          </p>
        ) : null}
        {query.isPending ? <p className={styles.status}>{t("advising:overview.loadingStudents")}</p> : null}

        {!query.isPending && !query.isError && items.length === 0 ? (
          <p className={styles.status}>
            {deferredSearch || Object.values(filters).some(Boolean)
              ? t("advising:students.noMatches")
              : t("advising:students.empty")}
          </p>
        ) : null}

        {!query.isPending && !query.isError && items.length > 0 ? (
          <div className={listStyles.tableContainer}>
            <table className={listStyles.table}>
              <caption className={listStyles.srOnly}>{t("advising:students.table")}</caption>
              <thead>
                <tr>
                  <th scope="col" style={{width: '3.5rem'}}>
                    <input
                      type="checkbox"
                      className={listStyles.checkboxInput}
                      checked={items.length > 0 && selectedStudentIds.length === items.length}
                      onChange={toggleSelectAll}
                      aria-label={t("advising:students.selectAll")}
                    />
                  </th>
                  <th scope="col">{t("common:roles.STUDENT")}</th>
                  <th scope="col">{t("records:fields.targetGoal")}</th>
                  <th scope="col">{t("advising:actionTasks.priority")}</th>
                  <th scope="col">{t("advising:students.lastActivity")}</th>
                  <th scope="col">{t("common:fields.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(student => {
                  const name = formatPersonName(student, t('common:people.studentFallback', {id: formatNumber(student.studentUserId)}));
                  const isChecked = selectedStudentIds.includes(student.studentUserId);
                  const studentIdFormatted = t('advising:studentWorkspace.studentId', {id: formatNumber(student.studentUserId)});

                  return (
                    <tr key={student.studentUserId}>
                      <td>
                        <input
                          type="checkbox"
                          className={listStyles.checkboxInput}
                          checked={isChecked}
                          onChange={() => toggleSelectStudent(student.studentUserId)}
                          aria-label={t('operations:selectTarget', {target: name})}
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
                      <td data-label={t("records:fields.targetGoal")} className={listStyles.targetScore}>
                        {student.targetGoal || t("assessment:submission.notSet")}
                      </td>

                      <td data-label={t("advising:actionTasks.priority")}>
                        <AdvisingBadge value={student.highestPriority ?? student.riskStatus} kind={student.highestPriority ? "priority" : "risk"}/>
                      </td>

                      <td data-label={t("advising:students.lastActivity")} className={listStyles.activityCell}>
                        {student.lastActivityAt
                          ? formatUtcTimestamp(student.lastActivityAt)
                          : t("common:feedback.notAvailable")}
                      </td>
                      <td>
                        <div className={listStyles.actionCell}>
                          <Link
                            className={listStyles.viewBtn}
                            aria-label={t('course:materials.openNamed', {name})}
                            to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdStudyPlan, {
                              studentUserId: String(student.studentUserId),
                            })}
                          >
                            {t("common:actions.view")}</Link>
                          <Link
                            className={listStyles.iconBtn}
                            aria-label={t('common:actions.messagePerson', {name})}
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
            {query.isSuccess ? t('advising:students.range', {start: formatNumber(total === 0 ? 0 : page * ADVISOR_PAGE_SIZE + 1), end: formatNumber(Math.min((page + 1) * ADVISOR_PAGE_SIZE, total)), total: formatNumber(total)}) : '—'}
          </span>

          <div className={listStyles.pagePills}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              aria-label={t('common:navigationControls.previousPage')} title={t('common:navigationControls.previousPage')}
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            {paginationItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span className={listStyles.ellipsis} aria-hidden="true" key={`ellipsis-${index}`}>…</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  aria-label={t('common:pagination.page', {page: formatNumber(item + 1)})}
                  aria-current={page === item ? 'page' : undefined}
                  data-active={page === item ? 'true' : undefined}
                  onClick={() => setPage(item)}
                >
                  {formatNumber(item + 1)}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage(page + 1)}
              aria-label={t('common:navigationControls.nextPage')} title={t('common:navigationControls.nextPage')}
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>

          <span>{t('advising:students.rowsPerPage', {number: formatNumber(ADVISOR_PAGE_SIZE)})}</span>
        </div>

        {selectedStudentIds.length > 0 ? <div className={listStyles.floatingSelectionBar}>
        <span>{t('assessment:quizGrading.selected', {number: formatNumber(selectedStudentIds.length)})}</span>
        <button type="button" onClick={() => setSelectedStudentIds([])}>{t("advising:students.clearSelection")}</button>
      </div> : null}
      </section>
    </div>
  );
};

export default AdvisorStudentsPage;
