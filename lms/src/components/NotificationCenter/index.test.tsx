import i18n from '@/i18n';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@testing-library/jest-dom';
import {notificationApiService} from '@/apis/services/notification-api';
import NotificationCenter from './index';

vi.mock('@/apis/services/notification-api', () => ({
  notificationApiService: {
    getUnreadCount: vi.fn(),
    getNotifications: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

const response = <T,>(data: T) => ({
  status: 200,
  code: 'SUCCESS',
  message: 'Success',
  timestamp: '2026-08-18T12:00:00Z',
  data,
});

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationApiService.getUnreadCount).mockResolvedValue(response({unreadCount: 0}));
    vi.mocked(notificationApiService.getNotifications).mockResolvedValue(response({
      items: [], page: 1, size: 20, total: 0,
    }));
    vi.mocked(notificationApiService.markAllRead).mockResolvedValue(response({unreadCount: 0}));
  });

  it('keeps Mark all read available when the unread count is zero', async () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><NotificationCenter/></MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', {name: 'Notifications'}));
    const markAll = await screen.findByRole('button', {name: 'Mark all read'});
    expect(markAll).toBeEnabled();
    fireEvent.click(markAll);

    await waitFor(() => expect(notificationApiService.markAllRead).toHaveBeenCalledOnce());
  });
});

it('updates structured notification text and its accessible name when the locale changes', async () => {
  await i18n.changeLanguage('en');
  vi.mocked(notificationApiService.getUnreadCount).mockResolvedValue(response({unreadCount: 1}));
  vi.mocked(notificationApiService.getNotifications).mockResolvedValue(response({items: [{notificationId: 1, tenantId: 1, recipientUserId: 1, notificationType: 'ASSIGNMENT_PUBLISHED', message: 'Original English notification', templateVars: {assignmentTitle: 'Authored essay'}, availability: 'AVAILABLE', deepLink: '/course/37/assignments/1', createdAt: '2026-09-09T12:00:00Z'}], page: 1, size: 20, total: 1}));
  const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
  render(<QueryClientProvider client={client}><MemoryRouter><NotificationCenter/></MemoryRouter></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', {name: /Notifications/}));
  await screen.findByText('Assignment published: Authored essay');
  for (const locale of ['zh-CN', 'zh-TW', 'en']) {
    await act(() => i18n.changeLanguage(locale));
    const message = i18n.t('notification:messages.ASSIGNMENT_PUBLISHED', {assignmentTitle: 'Authored essay'});
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByRole('button', {name: i18n.t('notification:open', {message})})).toBeVisible();
    expect(screen.queryByText('Original English notification')).not.toBeInTheDocument();
  }
  client.clear();
});

it('renders an unknown notification type safely even if its name is an object prototype property', async () => {
  vi.mocked(notificationApiService.getUnreadCount).mockResolvedValue(response({unreadCount: 1}));
  vi.mocked(notificationApiService.getNotifications).mockResolvedValue(response({items: [{notificationId: 1, tenantId: 1, recipientUserId: 1, notificationType: 'constructor', message: 'Unknown event retained', templateVars: {}, availability: 'NO_LONGER_AVAILABLE', createdAt: '2026-09-09T12:00:00Z'}], page: 1, size: 20, total: 1}));
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  render(<QueryClientProvider client={client}><MemoryRouter><NotificationCenter/></MemoryRouter></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', {name: /Notifications/}));
  expect(await screen.findByText('Unknown event retained')).toBeVisible();
  client.clear();
});
