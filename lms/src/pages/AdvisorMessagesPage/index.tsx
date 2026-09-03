import {useState} from 'react';
import {useSearchParams, Link, generatePath} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {advisorConversationViews} from '../AdvisorOperationsPage/advisorViewModels';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import SupportPage from '../AdvisorStudentWorkspacePage/SupportPage';
import styles from './index.module.scss';

export default function AdvisorMessagesPage() {
  const [params, setParams] = useSearchParams();
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
    retry: false,
  });
  const rows = advisorConversationViews(conversations.data);
  const student = rows.find((row) => row.studentUserId === selectedId);
  return (
    <main className={styles.page}>
      <h1>Messages</h1>
      <div className={styles.workspace} data-selected={selected || undefined}>
        <aside className={styles.directory} aria-label="Student conversations">
          <header>
            <h2>Students</h2>
            <label>
              Search conversations
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => {
                  setUnreadOnly(event.target.checked);
                  setPage(0);
                }}
              />
              Unread only
            </label>
          </header>
          {conversations.isPending ? (
            <p role="status">Loading conversations…</p>
          ) : null}
          {conversations.isError ? (
            <div role="alert">
              <p>Conversations could not be loaded.</p>
              <button
                type="button"
                onClick={() => void conversations.refetch()}
              >
                Try again
              </button>
            </div>
          ) : null}
          {!conversations.isPending &&
          !conversations.isError &&
          rows.length === 0 ? (
            <p>No conversations match this view.</p>
          ) : null}
          <ul>
            {rows.map((row) => (
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
                    <small>{row.latestPreview || 'Start a conversation'}</small>
                  </span>
                  {row.unreadCount > 0 ? (
                    <span className={styles.unread}>{row.unreadCount}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <AdvisingPagination
            label="Conversation pages"
            page={page}
            total={conversations.data?.total ?? 0}
            onPage={setPage}
          />
        </aside>
        <section className={styles.thread} aria-label="Active conversation">
          {selected ? (
            <>
              <header className={styles.threadHeader}>
                <button
                  type="button"
                  className={styles.back}
                  onClick={() => setParams({})}
                >
                  Back to conversations
                </button>
                <h2>{student?.studentName || `Student #${selectedId}`}</h2>
                <Link
                  to={generatePath(
                    APP_ROUTE_PATHS.advisorStudentsStudentUserId,
                    {studentUserId: String(selectedId)},
                  )}
                >
                  Student profile
                </Link>
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
              <h2>Select a conversation</h2>
              <p>Choose a student to read messages and reply.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
