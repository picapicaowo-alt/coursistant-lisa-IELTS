import React from 'react';
import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {ApiResponse} from '@/apis';
import {adminApiService} from '@/apis/services/admin-api';
import TenantStudentRecordPage from './index';

vi.mock('@/apis/services/admin-api', () => ({adminApiService: {getTenantUser: vi.fn()}}));
vi.mock('@/components/ParentLinksPanel', () => ({ParentLinksPanel: () => <div>Parent links</div>}));

const success = <T,>(data: T): ApiResponse<T> => ({
  status: 200,
  code: 'SUCCESS',
  data,
  message: 'Success',
  timestamp: '2026-08-31T10:40:00Z',
});

describe('TenantStudentRecordPage', () => {
  it('uses the tenant user directory and keeps Parent links available', async () => {
    vi.mocked(adminApiService.getTenantUser).mockResolvedValue(success({
      id: 448,
      tenantId: 1,
      firstName: 'Integration',
      lastName: 'Student',
      email: 'student@example.test',
      role: 'USER',
      level: 'STUDENT',
      status: 'ACTIVE',
    }));
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/students/448']}>
          <Routes><Route path="/admin/students/:studentUserId" element={<TenantStudentRecordPage/>}/></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Integration Student')).toBeInTheDocument();
    expect(screen.getByText('Parent links')).toBeInTheDocument();
    expect(adminApiService.getTenantUser).toHaveBeenCalledWith(448);
  });
});
