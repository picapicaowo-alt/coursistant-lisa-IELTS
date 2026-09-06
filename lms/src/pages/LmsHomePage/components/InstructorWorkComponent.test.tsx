import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {GradingQueueItem} from '@/apis';
import {dashboardApiService} from '@/apis/services/dashboard-api';
import i18n from '@/i18n';
import {SUPPORTED_LOCALES} from '@/i18n/configuration';
import InstructorWorkComponent from './InstructorWorkComponent';
import {buildTeachingWork} from './teachingWork';

vi.mock('@/apis/services/dashboard-api', () => ({dashboardApiService: {getGradingQueue: vi.fn(), getRecentActivity: vi.fn()}}));
const response = <T,>(data: T) => ({status: 200, code: 'SUCCESS', message: '', timestamp: '2026-09-05T08:00:00Z', data});
const item: GradingQueueItem = {kind: 'AssignmentUngraded', courseId: 31, courseCode: 'WR101', title: 'Authored essay title', pendingCount: 4, oldestWaitingAt: '2026-09-05T07:36:24Z', waitingMinutes: 20, timezone: 'Asia/Shanghai', assignmentId: 81, quizId: null};
let client: QueryClient;
const mount = () => render(<MemoryRouter><QueryClientProvider client={client}><InstructorWorkComponent/></QueryClientProvider></MemoryRouter>);
beforeEach(async () => {
  vi.resetAllMocks(); await i18n.changeLanguage('en');
  client = new QueryClient({defaultOptions: {queries: {retry: false, retryDelay: 0}}});
  vi.mocked(dashboardApiService.getGradingQueue).mockResolvedValue(response([]));
});
afterEach(async () => {cleanup(); client.clear(); await i18n.changeLanguage('en');});

describe('teacher home current work', () => {
  it('combines grading and release for one assignment and reacts to all locales without refetching', async () => {
    vi.mocked(dashboardApiService.getGradingQueue).mockResolvedValue(response([item, {...item, kind: 'AssignmentAwaitingRelease', pendingCount: 2}]));
    mount(); await screen.findByText(item.title);
    for (const locale of SUPPORTED_LOCALES) {
      await act(() => i18n.changeLanguage(locale));
      const panel = within(screen.getByRole('region', {name: i18n.t('dashboard:teachingWork.title')}));
      const work = panel.getByRole('link', {name: /Authored essay title/});
      expect(work).toHaveAttribute('href', '/course/31/assignments/81/grading');
      expect(work).toHaveTextContent(i18n.t('dashboard:teachingWork.toGrade', {count: 4}));
      expect(work).toHaveTextContent(i18n.t('dashboard:teachingWork.toRelease', {count: 2}));
      expect(work).toHaveTextContent(i18n.t('dashboard:teachingWork.grade'));
      expect(panel.getAllByText(item.title)).toHaveLength(1);
      expect(panel.queryByText(/AssignmentUngraded|AwaitingRelease|dashboard:/)).not.toBeInTheDocument();
    }
    expect(dashboardApiService.getGradingQueue).toHaveBeenCalledTimes(1);
    expect(dashboardApiService.getRecentActivity).not.toHaveBeenCalled();
  });

  it('preserves course boundaries, excludes legacy quizzes, and directs release-only work correctly', async () => {
    vi.mocked(dashboardApiService.getGradingQueue).mockResolvedValue(response([
      {...item, kind: 'AssignmentAwaitingRelease', pendingCount: 1},
      {...item, kind: 'QuizManualPending', title: 'Authored quiz', assignmentId: null, quizId: 81},
      {...item, courseId: 32, title: 'Another course essay'},
    ]));
    mount();
    const release = await screen.findByRole('link', {name: /Authored essay title/});
    expect(release).toHaveTextContent('1 grade to release');
    expect(release).toHaveTextContent('Review and release');
    expect(release).not.toHaveTextContent('to grade');
    expect(screen.queryByRole('link', {name: /Authored quiz/})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Another course essay/})).toHaveAttribute('href', '/course/32/assignments/81/grading');
  });

  it('shows a scoped empty state and never requests historical activity', async () => {
    mount(); await screen.findByText(i18n.t('dashboard:teachingWork.empty'));
    for (const locale of SUPPORTED_LOCALES) {
      await act(() => i18n.changeLanguage(locale));
      expect(screen.getByRole('status')).toHaveTextContent(i18n.t('dashboard:teachingWork.empty'));
      expect(screen.queryByRole('region', {name: i18n.t('dashboard:recentActivity')})).not.toBeInTheDocument();
      expect(screen.getByRole('link', {name: i18n.t('dashboard:teachingWork.viewAll')})).toHaveAttribute('href', '/my-operations');
    }
    expect(dashboardApiService.getRecentActivity).not.toHaveBeenCalled();
  });

  it('does not claim an empty queue on failure and recovers through retry', async () => {
    vi.mocked(dashboardApiService.getGradingQueue).mockRejectedValue({code: 503});
    mount(); await screen.findByRole('alert');
    expect(screen.queryByText(i18n.t('dashboard:teachingWork.empty'))).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    vi.mocked(dashboardApiService.getGradingQueue).mockResolvedValue(response([item]));
    fireEvent.click(screen.getByRole('button', {name: i18n.t('common:actions.retry')}));
    await screen.findByText(item.title);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps unknown queue details out of the UI without falsely claiming there is no work', async () => {
    vi.mocked(dashboardApiService.getGradingQueue).mockResolvedValue(response([{...item, kind: 'FUTURE_KIND' as GradingQueueItem['kind'], title: 'INTERNAL_CODE user=26'}]));
    mount(); await screen.findByText(i18n.t('dashboard:teachingWork.moreWork'));
    expect(screen.queryByText(/INTERNAL_CODE|user=26|FUTURE_KIND/)).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('dashboard:teachingWork.empty'))).not.toBeInTheDocument();
  });

  it('never builds broken links and excludes completed aggregates', () => {
    expect(buildTeachingWork([{...item, pendingCount: 0}])).toEqual({items: [], hasUnsupportedItems: false});
    expect(buildTeachingWork([{...item, assignmentId: null}])).toEqual({items: [], hasUnsupportedItems: true});
  });
});
