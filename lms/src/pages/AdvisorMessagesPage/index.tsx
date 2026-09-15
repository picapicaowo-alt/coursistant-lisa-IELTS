import { useTranslation } from 'react-i18next';
import {formatDateTime, formatNumber} from '@/i18n/formatting';
import {useState} from 'react';
import {useSearchParams, Link, generatePath} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {formatPersonName} from '@/utils/personName';
import {PersonCell} from '@/components/PersonCell';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {advisorConversationViews} from '../AdvisorOperationsPage/advisorViewModels';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import SupportPage from '../AdvisorStudentWorkspacePage/SupportPage';
import styles from './index.module.scss';

export default function AdvisorMessagesPage() {
  const { t: translate } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [directoryView, setDirectoryView] = useState<'conversations' | 'students'>('conversations');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const selectedId = Number(params.get('studentUserId'));
  const selected = Number.isInteger(selectedId) && selectedId > 0;
  const conversations = useQuery({
    queryKey: ['advisor', 'conversations', page, query.trim(), unreadOnly],
    queryFn: async () =>
      unwrapData(
        await advisorApiService.listConversations(page, ADVISOR_PAGE_SIZE, {
          q: query.trim() || undefined,
          unreadOnly,
        }),
        'advisorConversations',
      ),
    enabled: directoryView === 'conversations',
    retry: false,
  });
  const students = useQuery({
    queryKey: ['advisor', 'message-students', page, query.trim()],
    queryFn: async () => unwrapData(await advisorApiService.listStudents(page, ADVISOR_PAGE_SIZE, {q: query.trim() || undefined}), 'advisorStudents'),
    enabled: directoryView === 'students',
    retry: false,
  });
  const selectedStudent = useQuery({
    queryKey: ['advisor', 'student-hub', selectedId],
    meta: {advisingStudentId: selectedId},
    queryFn: async () => unwrapData(await advisorApiService.getStudentHub(selectedId), 'advisorStudentHub'),
    enabled: selected,
    retry: false,
  });
  const directory = directoryView === 'students' ? students : conversations;
  const rows = advisorConversationViews(conversations.data);
  const student = rows.find((row) => row.studentUserId === selectedId);
  return (
    <div className={styles.page}>
      <h1>{translate("navigation:messages")}</h1>
      <div className={styles.workspace} data-selected={selected || undefined}>
        <aside className={styles.directory} aria-label={translate("advising:messages.directory")}>
          <header>
            <h2>{translate("common:people.students")}</h2>
            <div className={styles.directoryViews} role="group" aria-label={translate('advising:messages.directory')}>
              {(['conversations', 'students'] as const).map(view => <button type="button" key={view} aria-pressed={directoryView === view} onClick={() => {setDirectoryView(view); setQuery(''); setPage(0); setUnreadOnly(false);}}>{translate(`advising:messages.views.${view}`)}</button>)}
            </div>
            <label>
              {translate(directoryView === 'students' ? "advising:messages.searchStudents" : "advising:messages.search")}<input
                type="search"
                maxLength={100}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            {directoryView === 'conversations' ? <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => {
                  setUnreadOnly(event.target.checked);
                  setPage(0);
                }}
              />
              {translate("advising:messages.unreadOnly")}</label> : <p className={styles.directoryHint}>{translate("advising:messages.studentsHint")}</p>}
          </header>
          {directory.isPending ? (
            <p role="status">{translate(directoryView === "students" ? "advising:messages.loadingStudents" : "advising:messages.loading")}</p>
          ) : null}
          {directory.isError ? (
            <div role="alert">
              <p>{translate(directoryView === "students" ? "advising:messages.studentsFailed" : "advising:messages.failed")}</p>
              <button
                type="button"
                onClick={() => void directory.refetch()}
              >
                {translate("common:actions.tryAgain")}</button>
            </div>
          ) : null}
          {!directory.isPending &&
          !directory.isError &&
          (directoryView === "students" ? students.data?.items.length ?? 0 : rows.length) === 0 ? (
            <p>{translate(directoryView === "students" ? "advising:messages.studentsEmpty" : "advising:messages.empty")}</p>
          ) : null}
          <ul>
            {directoryView === "students" ? (students.data?.items ?? []).map(person => <li key={person.studentUserId}><button type="button" className={styles.person} aria-current={person.studentUserId === selectedId ? "true" : undefined} onClick={() => setParams({studentUserId: String(person.studentUserId)})}><PersonCell person={person}/></button></li>) : rows.map((row) => (
              <li key={row.studentUserId}>
                <button
                  type="button"
                  className={styles.person}
                  aria-current={
                    row.studentUserId === selectedId ? 'true' : undefined
                  }
                  onClick={() =>
                    setParams({studentUserId: String(row.studentUserId)})
                  }
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {row.studentName.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{row.studentName}</strong>
                    {row.latestAt && !Number.isNaN(Date.parse(row.latestAt)) ? <time dateTime={row.latestAt}>{formatDateTime(new Date(row.latestAt), {month: "short", day: "numeric", hour: "numeric", minute: "2-digit"})}</time> : null}
                    <small>{row.latestPreview || translate("advising:overview.startConversation")}</small>
                  </span>
                  {row.unreadCount > 0 ? (
                    <span className={styles.unread}>{formatNumber(row.unreadCount)}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <AdvisingPagination
            label={translate(directoryView === "students" ? "advising:messages.studentPages" : "advising:messages.pages")}
            page={page}
            total={directory.data?.total ?? 0}
            onPage={setPage}
          />
        </aside>
        <section className={styles.thread} aria-label={translate("advising:messages.active")}>
          {selected ? (
            <>
              <header className={styles.threadHeader}>
                <button
                  type="button"
                  className={styles.back}
                  onClick={() => setParams({})}
                >
                  {translate("advising:messages.back")}</button>
                <h2>{formatPersonName(selectedStudent.data, student?.studentName || translate('common:people.studentFallback', {id: formatNumber(selectedId)}))}</h2>
                <Link
                  to={generatePath(
                    APP_ROUTE_PATHS.advisorStudentsStudentUserId,
                    {studentUserId: String(selectedId)},
                  )}
                >
                  {translate("advising:profile.title")}</Link>
              </header>
              <SupportPage
                key={selectedId}
                studentId={selectedId}
                conversationOnly
              />
            </>
          ) : (
            <div className={styles.empty}>
              <img src="/icons/figma-dashboard/ai-chat.svg" alt="" />
              <h2>{translate("advising:messages.select")}</h2>
              <p>{translate("advising:messages.selectHelp")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
