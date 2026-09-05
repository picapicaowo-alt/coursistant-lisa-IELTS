import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import i18n from '@/i18n';
import {InstructorAvailabilityPanel} from './InstructorAvailabilityPanel';

const api = vi.hoisted(() => ({availability: vi.fn(), instructors: vi.fn()}));
vi.mock('@/apis/services/course-operations-api', () => ({courseOperationsApiService: {getAdvisorInstructorAvailability: api.availability}}));
vi.mock('@/apis/services/advisor-api', () => ({advisorApiService: {listInstructors: api.instructors}}));
const response = (data: unknown) => ({code: 'SUCCESS', status: 200, data});
const failure = {code: 404, details: {code: 'USER_NOT_FOUND', message: 'User Does Not Exist'}};

function mount() {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  render(<QueryClientProvider client={client}><MemoryRouter><InstructorAvailabilityPanel/></MemoryRouter></QueryClientProvider>);
  return client;
}
async function select(name: string) {
  fireEvent.focus(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', {name: new RegExp(name)}));
}
function check() {fireEvent.click(screen.getByRole('button', {name: i18n.t('advising:availability.check')}));}

describe('instructor availability lookup', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await i18n.changeLanguage('en');
    api.instructors.mockResolvedValue(response({items: [{instructorUserId: 15, firstName: 'Emily', lastName: 'Ward'}, {instructorUserId: 16, firstName: 'James', lastName: 'Chen'}], page: 0, size: 20, total: 2}));
  });

  it('uses directory IDs and retries the same teacher without changing selection', async () => {
    api.availability.mockRejectedValueOnce(failure).mockResolvedValueOnce(response({instructorUserId: 15, windows: [], exceptions: []}));
    mount();
    await select('Emily');
    expect(api.availability).not.toHaveBeenCalled();
    check();
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('advising:availability.instructorUnavailable'));
    expect(screen.queryByText('User Does Not Exist')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('advising:availability.empty'))).not.toBeInTheDocument();
    check();
    expect(await screen.findByText(i18n.t('advising:availability.empty'))).toBeInTheDocument();
    expect(api.availability.mock.calls).toEqual([[15], [15]]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears a failed result immediately when changing or clearing the teacher', async () => {
    api.availability.mockRejectedValue(failure);
    mount(); await select('Emily'); check();
    await screen.findByRole('alert');
    await select('James');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    check(); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', {name: 'Clear instructor'}));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Check availability'})).toBeDisabled();
    expect(api.availability.mock.calls).toEqual([[15], [16]]);
  });

  it('does not display a previous teacher’s late response or block the new lookup', async () => {
    let finish: (value: ReturnType<typeof response>) => void = () => undefined;
    api.availability.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}))
      .mockResolvedValueOnce(response({instructorUserId: 16, windows: [{dayOfWeek: 'TUE', timezone: 'Asia/Taipei'}]}));
    mount(); await select('Emily'); check();
    await waitFor(() => expect(api.availability).toHaveBeenCalledWith(15));
    await select('James'); check();
    expect(await screen.findByText('Asia/Taipei')).toBeInTheDocument();
    await act(async () => finish(response({instructorUserId: 15, windows: [{timezone: 'America/Los_Angeles'}]})));
    expect(screen.queryByText('America/Los_Angeles')).not.toBeInTheDocument();
    expect(screen.getByText('Asia/Taipei')).toBeInTheDocument();
  });

  it('does not show cached successful availability after a failed refresh', async () => {
    api.availability.mockResolvedValueOnce(response({windows: [{timezone: 'Asia/Taipei'}]})).mockRejectedValueOnce(failure);
    mount(); await select('Emily'); check();
    await screen.findByText('Asia/Taipei'); check();
    await screen.findByRole('alert');
    expect(screen.queryByText('Asia/Taipei')).not.toBeInTheDocument();
  });

  it.each(['en', 'zh-CN', 'zh-TW'])('renders the availability result and failure in %s', async locale => {
    await i18n.changeLanguage(locale);
    api.availability.mockResolvedValueOnce(response({windows: [{dayOfWeek: 'MON', startTime: '09:00:00', endTime: '17:00:00', timezone: 'Asia/Taipei'}], exceptions: [{exceptionDate: '2026-09-10'}]})).mockRejectedValueOnce(failure);
    mount(); await select('Emily'); check();
    expect(await screen.findByText(i18n.t('advising:availability.windows'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('advising:availability.fields.timezone'))).toBeInTheDocument();
    expect(screen.queryByText('Windows', {exact: true})).not.toBeInTheDocument();
    check();
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('advising:availability.instructorUnavailable'));
  });
});
