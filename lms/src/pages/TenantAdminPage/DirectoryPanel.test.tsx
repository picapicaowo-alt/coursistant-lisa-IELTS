import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {DirectoryPanel} from './DirectoryPanel';

const mocks = vi.hoisted(() => ({
  listTenantUsers: vi.fn(),
  getTenantUser: vi.fn(),
  createTenantManagedUser: vi.fn(),
  changeTenantManagedUserRole: vi.fn(),
  disableTenantManagedUser: vi.fn(),
  enableTenantManagedUser: vi.fn(),
  listTenants: vi.fn(),
  listUsers: vi.fn(),
}));

vi.mock('@/apis/services/admin-api', () => ({adminApiService: mocks}));
vi.mock('@/contexts/RequiredAuthContext', () => ({useRequiredAuth: () => ({user: {id: 99, userId: 99, role: 'TENANT_ADMIN', level: null}})}));

const response = <T,>(data: T) => ({status: 200, code: 'SUCCESS', data, message: 'OK', timestamp: '2026-09-02T00:00:00Z'});
const instructor = {id: 41, tenantId: 7, firstName: 'Ivy', lastName: 'Instructor', email: 'ivy@example.com', role: 'USER' as const, level: 'INSTRUCTOR' as const, status: 'ACTIVE' as const};

const renderPanel = () => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  return render(<QueryClientProvider client={client}><DirectoryPanel/></QueryClientProvider>);
};

describe('Tenant Admin directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTenantUsers.mockResolvedValue(response({items: [instructor], page: 0, size: 20, total: 1}));
    mocks.getTenantUser.mockResolvedValue(response(instructor));
  });

  it('uses server-side name/email search and never mounts system directory calls', async () => {
    renderPanel();
    await screen.findByText('Ivy Instructor');
    fireEvent.change(screen.getByLabelText('Search by name or email'), {target: {value: 'ivy@example.com'}});
    fireEvent.click(screen.getByRole('button', {name: 'Apply filters'}));
    await waitFor(() => expect(mocks.listTenantUsers).toHaveBeenLastCalledWith(expect.objectContaining({q: 'ivy@example.com', page: 0, size: 20})));
    expect(mocks.listTenants).not.toHaveBeenCalled();
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it('offers only the allowlisted identity transition', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', {name: /Ivy Instructor/}));
    const select = await screen.findByLabelText('Convert identity');
    const options = within(select).getAllByRole('option').map(option => option.textContent);
    expect(options).toEqual(['Choose allowed target', 'INSTRUCTOR_ADVISOR']);
    expect(screen.queryByRole('option', {name: 'STUDENT'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'TENANT_ADMIN'})).not.toBeInTheDocument();
  });
});
