import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PersonalEventEditor} from '@/pages/CalendarPage/PersonalEventEditor';
import {courseOperationsApiService as api} from '@/apis/services/course-operations-api';
import i18n from './index';
import {SUPPORTED_LOCALES} from './configuration';

vi.mock('@/apis/services/course-operations-api', () => ({courseOperationsApiService: {
  listMyPersonalEvents: vi.fn(), getMyPersonalEvent: vi.fn(), patchMyPersonalEvent: vi.fn(),
  createMyPersonalEvent: vi.fn(), deleteMyPersonalEvent: vi.fn(),
}}));

const event = {id: 71, title: 'Authored title', startsAtLocal: '2026-09-10T10:00:00', endsAtLocal: '2026-09-10T11:00:00', timezone: 'Asia/Singapore', version: 1};
const response = (data: unknown) => ({status: 200, code: 'SUCCESS', message: '', timestamp: '2026-09-10T12:00:00Z', data});
const clients: QueryClient[] = [];
function mount(ui: React.ReactNode) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}, mutations: {retry: false}}});
  clients.push(client);
  return render(<MemoryRouter><QueryClientProvider client={client}>{ui}</QueryClientProvider></MemoryRouter>);
}

beforeEach(() => {
  vi.resetAllMocks();
  // jsdom does not implement modal layout; browser tests cover focus and geometry.
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {this.setAttribute('open', '');});
  vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {} unobserve() {}});
  vi.mocked(api.listMyPersonalEvents).mockResolvedValue(response([]));
  vi.mocked(api.getMyPersonalEvent).mockResolvedValue(response({...event, version: 4}));
});
afterEach(async () => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await i18n.changeLanguage('en');
});

describe('calendar localization without changing event contracts', () => {
  it('keeps draft, wall-clock payload, latest version and retry key across languages after a failed update', async () => {
    const close = vi.fn();
    vi.mocked(api.patchMyPersonalEvent).mockRejectedValueOnce(new Error('Opaque English server diagnostic')).mockResolvedValueOnce(response({id: 71, version: 5}));
    mount(<PersonalEventEditor selected={event} onClose={close}/>);
    await waitFor(() => expect(screen.getByLabelText('Event title')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Event title'), {target: {value: 'Revised / 自拟日程'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save changes'}));
    await screen.findByRole('alert');
    for (const locale of SUPPORTED_LOCALES) {
      await act(() => i18n.changeLanguage(locale));
      expect(screen.getByRole('dialog')).toHaveAccessibleName(i18n.t('calendar:editor.editTitle'));
      expect(screen.getByLabelText(i18n.t('calendar:editor.title'))).toHaveValue('Revised / 自拟日程');
      expect(screen.getByLabelText(i18n.t('calendar:editor.reminder'))).toHaveValue(null);
      expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('calendar:editor.saveFailed'));
      expect(screen.queryByText('Opaque English server diagnostic')).not.toBeInTheDocument();
    }
    expect(api.getMyPersonalEvent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', {name: i18n.t('common:actions.saveChanges')}));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    const calls = vi.mocked(api.patchMyPersonalEvent).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]);
    expect(calls[0][2]).toBeTruthy();
    expect(calls[0][1]).toEqual({title: 'Revised / 自拟日程', startsAtLocal: event.startsAtLocal, endsAtLocal: event.endsAtLocal, timezone: event.timezone, expectedVersion: 4, reminderMinutesBefore: undefined});
  });

  it('localizes delete confirmation and delete-specific failures without changing identity or retry key', async () => {
    vi.mocked(api.deleteMyPersonalEvent).mockRejectedValue(new Error('Opaque delete diagnostic'));
    mount(<PersonalEventEditor selected={event} onClose={vi.fn()}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    for (const locale of SUPPORTED_LOCALES) {
      await act(() => i18n.changeLanguage(locale));
      expect(screen.getByText(i18n.t('calendar:editor.deleteConfirm', {title: event.title}))).toBeVisible();
      fireEvent.click(screen.getByRole('button', {name: i18n.t('calendar:editor.delete')}));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('calendar:editor.deleteFailed')));
      await waitFor(() => expect(screen.getByRole('button', {name: i18n.t('calendar:editor.delete')})).toBeEnabled());
    }
    const calls = vi.mocked(api.deleteMyPersonalEvent).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls.every(call => call[0] === event.id && call[1] === calls[0][1] && call[2] === 4)).toBe(true);
    expect(calls[0][1]).toBeTruthy();
  });

  it('refreshes a delete conflict, preserves the event and requires confirmation with the new version', async () => {
    const close = vi.fn();
    vi.mocked(api.deleteMyPersonalEvent)
      .mockRejectedValueOnce({code: 409, details: {code: 'PERSONAL_EVENT_VERSION_CONFLICT'}})
      .mockResolvedValueOnce({...response(null), data: null});
    mount(<PersonalEventEditor selected={event} onClose={close}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled());
    vi.mocked(api.getMyPersonalEvent).mockResolvedValue(response({...event, title: 'Updated elsewhere', version: 5}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    fireEvent.click(screen.getByRole('button', {name: i18n.t('calendar:editor.delete')}));
    await waitFor(() => expect(screen.getByLabelText(i18n.t('calendar:editor.title'))).toHaveValue('Updated elsewhere'));
    expect(close).not.toHaveBeenCalled();
    expect(api.deleteMyPersonalEvent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', {name: 'Keep event'})).not.toBeInTheDocument();
    for (const locale of SUPPORTED_LOCALES) {
      await act(() => i18n.changeLanguage(locale));
      expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('calendar:editor.versionConflict'));
    }
    await act(() => i18n.changeLanguage('en'));
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    fireEvent.click(screen.getByRole('button', {name: i18n.t('calendar:editor.delete')}));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    const calls = vi.mocked(api.deleteMyPersonalEvent).mock.calls;
    expect(calls[0][2]).toBe(4);
    expect(calls[1][2]).toBe(5);
    expect(calls[1][1]).not.toBe(calls[0][1]);
  });

  it('blocks further deletion when the conflict refresh fails', async () => {
    vi.mocked(api.deleteMyPersonalEvent).mockRejectedValue({code: 409, details: {code: 'PERSONAL_EVENT_VERSION_CONFLICT'}});
    mount(<PersonalEventEditor selected={event} onClose={vi.fn()}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled());
    vi.mocked(api.getMyPersonalEvent).mockRejectedValue({code: 500});
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    fireEvent.click(screen.getByRole('button', {name: i18n.t('calendar:editor.delete')}));
    await screen.findByText(i18n.t('calendar:editor.loadFailed'));
    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();
    expect(api.deleteMyPersonalEvent).toHaveBeenCalledTimes(1);
  });

  it('localizes missing-detail validation at render time without rerunning the detail read', async () => {
    vi.mocked(api.getMyPersonalEvent).mockResolvedValue(response({id: event.id}));
    mount(<PersonalEventEditor selected={event} onClose={vi.fn()}/>);
    await screen.findByRole('alert');
    for (const locale of SUPPORTED_LOCALES) {
      await act(() => i18n.changeLanguage(locale));
      expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('calendar:editor.missingDetails'));
      expect(screen.getByLabelText(i18n.t('calendar:editor.title'))).toBeDisabled();
    }
    expect(api.getMyPersonalEvent).toHaveBeenCalledTimes(1);
  });

  it('localizes new-event validation and creates the same wall-clock payload without a default reminder', async () => {
    const close = vi.fn();
    vi.mocked(api.createMyPersonalEvent).mockResolvedValue(response({id: 72}));
    mount(<PersonalEventEditor selected={null} onClose={close}/>);
    fireEvent.click(screen.getByRole('button', {name: i18n.t('calendar:editor.create')}));
    for (const locale of SUPPORTED_LOCALES) {
      await act(() => i18n.changeLanguage(locale));
      expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('calendar:editor.requiredTitle'));
    }
    fireEvent.change(screen.getByLabelText(i18n.t('calendar:editor.title')), {target: {value: 'New / 自拟日程'}});
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('calendar:editor.validDates'));
    fireEvent.change(screen.getByLabelText(i18n.t('calendar:editor.starts')), {target: {value: '2026-09-10T10:00'}});
    fireEvent.change(screen.getByLabelText(i18n.t('calendar:editor.ends')), {target: {value: '2026-09-10T11:00'}});
    fireEvent.change(screen.getByLabelText(i18n.t('calendar:editor.timezone')), {target: {value: 'Asia/Singapore'}});
    fireEvent.change(screen.getByLabelText(i18n.t('calendar:editor.reminder')), {target: {value: '-1'}});
    for (const locale of SUPPORTED_LOCALES) {
      await act(() => i18n.changeLanguage(locale));
      expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('calendar:editor.invalidReminder'));
    }
    expect(api.createMyPersonalEvent).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(i18n.t('calendar:editor.reminder')), {target: {value: ''}});
    fireEvent.click(screen.getByRole('button', {name: i18n.t('calendar:editor.create')}));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(api.createMyPersonalEvent).toHaveBeenCalledWith({title: 'New / 自拟日程', startsAtLocal: event.startsAtLocal, endsAtLocal: event.endsAtLocal, timezone: event.timezone, reminderMinutesBefore: undefined}, expect.any(String));
  });
});
