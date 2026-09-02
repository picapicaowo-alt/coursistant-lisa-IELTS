import '@testing-library/jest-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  listAdmins: vi.fn(),
  getTenantAlertRules: vi.fn(),
  putTenantAlertRules: vi.fn(),
  runAdminDigest: vi.fn(),
}));

vi.mock('@/apis/services/admin-api', () => ({
  adminApiService: {listAdmins: mocks.listAdmins},
}));
vi.mock('@/apis/services/course-operations-api', () => ({
  courseOperationsApiService: {
    getTenantAlertRules: mocks.getTenantAlertRules,
    putTenantAlertRules: mocks.putTenantAlertRules,
  },
}));
vi.mock('@/apis/services/notification-api', () => ({
  notificationApiService: {runAdminDigest: mocks.runAdminDigest},
}));

import {AdminContractOperations} from './AdminContractOperations';

const response = (data: unknown) => ({data});
const renderOperations = (isSystemAdmin: boolean) => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={client}>
      <AdminContractOperations isSystemAdmin={isSystemAdmin} users={[]}/>
    </QueryClientProvider>,
  );
};

describe('AdminContractOperations role scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call tenant-scoped alert APIs for a system administrator', async () => {
    mocks.listAdmins.mockResolvedValue(response([]));
    renderOperations(true);

    await waitFor(() => expect(mocks.listAdmins).toHaveBeenCalled());
    expect(mocks.getTenantAlertRules).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', {name: 'Tenant alert rules'})).not.toBeInTheDocument();
  });

  it('shows tenant alert rules without calling the system directory', async () => {
    mocks.getTenantAlertRules.mockResolvedValue(response({version: 3}));
    renderOperations(false);

    expect(await screen.findByRole('heading', {name: 'Tenant alert rules'})).toBeInTheDocument();
    await waitFor(() => expect(mocks.getTenantAlertRules).toHaveBeenCalled());
    expect(mocks.listAdmins).not.toHaveBeenCalled();
  });
});
