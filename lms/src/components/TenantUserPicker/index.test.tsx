import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {TenantUserPicker} from './index';

const mocks = vi.hoisted(() => ({listTenantUsers: vi.fn()}));
vi.mock('@/apis/services/admin-api', () => ({adminApiService: mocks}));

const response = <T,>(data: T) => ({status: 200, code: 'SUCCESS', data, message: 'OK', timestamp: '2026-09-02T00:00:00Z'});

describe('TenantUserPicker', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTenantUsers.mockResolvedValue(response({items: [
      {id: 51, tenantId: 7, firstName: 'Ari', lastName: 'Advisor', email: 'advisor@example.com', role: 'USER', level: 'ADVISOR', status: 'ACTIVE'},
      {id: 52, tenantId: 7, firstName: 'Indigo', lastName: 'Advisor', email: 'instructor-advisor@example.com', role: 'USER', level: 'INSTRUCTOR_ADVISOR', status: 'ACTIVE'},
    ], page: 0, size: 20, total: 2}));
  });

  it('queries both eligible advisor levels through the repeated levels parameter contract', async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><TenantUserPicker title="Choose advisor" description="Eligible advisors" triggerLabel="Choose advisor" levels={['ADVISOR', 'INSTRUCTOR_ADVISOR']} onSelect={vi.fn()}/></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', {name: 'Choose advisor'}));
    expect(await screen.findByText('Ari Advisor')).toBeInTheDocument();
    expect(await screen.findByText('Indigo Advisor')).toBeInTheDocument();
    await waitFor(() => expect(mocks.listTenantUsers).toHaveBeenCalledTimes(1));
    expect(mocks.listTenantUsers).toHaveBeenCalledWith(expect.objectContaining({role: 'USER', levels: ['ADVISOR', 'INSTRUCTOR_ADVISOR'], status: 'ACTIVE', page: 0, size: 20}));
  });
});
