import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {advisorApiService} from '@/apis/services/advisor-api';
import i18n from '@/i18n';
import AdvisorMessagesPage from './index';

vi.mock('@/apis/services/advisor-api', () => ({advisorApiService: {listConversations: vi.fn(), listStudents: vi.fn(), getStudentHub: vi.fn()}}));
vi.mock('../AdvisorStudentWorkspacePage/SupportPage', () => ({default: ({studentId}: {studentId: number}) => <div data-testid="selected-thread">{studentId}</div>}));
function renderMessages(path = '/advisor/messages') {
  return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><MemoryRouter initialEntries={[path]}><AdvisorMessagesPage/></MemoryRouter></QueryClientProvider>);
}
beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
  vi.mocked(advisorApiService.listConversations).mockResolvedValue({status: 200, code: 'SUCCESS', message: 'Success', timestamp: '2026-09-15T00:00:00Z', data: {items: [], page: 0, size: 20, total: 0}});
  vi.mocked(advisorApiService.listStudents).mockResolvedValue({status: 200, code: 'SUCCESS', message: 'Success', timestamp: '2026-09-15T00:00:00Z', data: {items: [{studentUserId: 42, firstName: 'Mina', lastName: 'Lee', email: 'mina@example.test', studentType: 'STANDARD', assignmentVersion: 0}], page: 0, size: 20, total: 21}});
  vi.mocked(advisorApiService.getStudentHub).mockResolvedValue({status: 200, code: 'SUCCESS', message: 'Success', timestamp: '2026-09-15T00:00:00Z', data: {studentUserId: 42, firstName: 'Mina', lastName: 'Lee', studentType: 'STANDARD', activeCourseCount: 1}});
});
it('opens a student with no conversation and keeps their identity while filtering', async () => {
  renderMessages();
  await screen.findByText('No conversations match this view.');
  fireEvent.click(screen.getByRole('button', {name: 'Student contacts'}));
  fireEvent.click(await screen.findByRole('button', {name: /Mina Lee/}));
  expect(await screen.findByRole('heading', {name: 'Mina Lee'})).toBeVisible();
  expect(screen.getByTestId('selected-thread')).toHaveTextContent('42');
  vi.mocked(advisorApiService.listStudents).mockResolvedValue({status: 200, code: 'SUCCESS', message: 'Success', timestamp: '2026-09-15T00:00:00Z', data: {items: [], page: 0, size: 20, total: 0}});
  fireEvent.change(screen.getByRole('searchbox', {name: 'Search students'}), {target: {value: 'Nobody'}});
  await screen.findByText('No students match your search.');
  expect(screen.getByRole('heading', {name: 'Mina Lee'})).toBeVisible();
});
it('paginates the student directory and resets the page on search', async () => {
  renderMessages();
  fireEvent.click(screen.getByRole('button', {name: 'Student contacts'}));
  fireEvent.click(await screen.findByRole('button', {name: 'Next'}));
  await waitFor(() => expect(advisorApiService.listStudents).toHaveBeenLastCalledWith(1, 20, {q: undefined}));
  fireEvent.change(screen.getByRole('searchbox', {name: 'Search students'}), {target: {value: 'Mina'}});
  await waitFor(() => expect(advisorApiService.listStudents).toHaveBeenLastCalledWith(0, 20, {q: 'Mina'}));
});
it('loads the selected student name for a direct link outside the conversation page', async () => {
  renderMessages('/advisor/messages?studentUserId=42');
  expect(await screen.findByRole('heading', {name: 'Mina Lee'})).toBeVisible();
  expect(screen.getByRole('link', {name: 'Student profile'})).toHaveAttribute('href', '/advisor/students/42');
});
it('localizes contacts when switching languages', async () => {
  renderMessages();
  fireEvent.click(screen.getByRole('button', {name: 'Student contacts'}));
  await screen.findByRole('button', {name: /Mina Lee/});
  await i18n.changeLanguage('zh-CN');
  expect(await screen.findByRole('button', {name: '学生通讯录'})).toBeVisible();
  expect(screen.getByRole('searchbox', {name: '搜索学生'})).toBeVisible();
  await i18n.changeLanguage('zh-TW');
  expect(await screen.findByRole('button', {name: '學生通訊錄'})).toBeVisible();
  expect(screen.queryByRole('button', {name: 'Student contacts'})).toBeNull();
});
