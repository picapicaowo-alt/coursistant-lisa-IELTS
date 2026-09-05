import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AuditPanel} from './AuditPanel';

const mocks = vi.hoisted(() => ({listTenantAuditEvents: vi.fn()}));
vi.mock('@/apis/services/admin-api', () => ({adminApiService: mocks}));

const response = <T,>(data: T) => ({status: 200, code: 'SUCCESS', data, message: 'OK', timestamp: '2026-09-02T00:00:00Z'});

const renderPanel = () => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  return render(<QueryClientProvider client={client}><AuditPanel/></QueryClientProvider>);
};

describe('Tenant Admin audit filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTenantAuditEvents.mockResolvedValue(response({items: [], page: 0, size: 20, total: 0}));
  });

  it('clears visible fields and reloads the unfiltered audit list', async () => {
    renderPanel();
    await waitFor(() => expect(mocks.listTenantAuditEvents).toHaveBeenCalled());
    expect(screen.queryByRole('button', {name: 'Clear filters'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Refresh audit'})).toHaveAttribute('title', 'Refresh audit');
    fireEvent.change(screen.getByLabelText('Action'), {target: {value: 'INTAKE_CREATED'}});
    fireEvent.click(screen.getByRole('button', {name: 'Apply filters'}));
    await waitFor(() => expect(mocks.listTenantAuditEvents).toHaveBeenLastCalledWith(expect.objectContaining({action: 'INTAKE_CREATED'})));

    fireEvent.click(screen.getByRole('button', {name: 'Refresh audit'}));
    await waitFor(() => expect(mocks.listTenantAuditEvents).toHaveBeenCalledTimes(3));
    expect(mocks.listTenantAuditEvents).toHaveBeenLastCalledWith(expect.objectContaining({action: 'INTAKE_CREATED'}));
    // Clearing the draft alone must not hide the reset for an applied filter.
    fireEvent.change(screen.getByLabelText('Action'), {target: {value: ''}});
    fireEvent.click(screen.getByRole('button', {name: 'Clear filters'}));

    expect(screen.getByLabelText('Action')).toHaveValue('');
    expect(screen.queryByRole('button', {name: 'Clear filters'})).not.toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Filters cleared');
    await waitFor(() => expect(mocks.listTenantAuditEvents).toHaveBeenLastCalledWith({page: 0, size: 20}));
  });
});
