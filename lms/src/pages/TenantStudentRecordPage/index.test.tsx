import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {ApiResponse, StudentIntakeResponse} from '@/apis';
import {adminApiService} from '@/apis/services/admin-api';
import TenantStudentRecordPage from './index';
import {tenantAdvisingApiService} from '@/apis/services/tenant-advising-api';

vi.mock('@/apis/services/admin-api', () => ({adminApiService: {getTenantUser: vi.fn()}}));
vi.mock('@/apis/services/tenant-advising-api', () => ({tenantAdvisingApiService: {listStudentIntakes: vi.fn()}}));
vi.mock('@/components/ParentLinksPanel', () => ({ParentLinksPanel: () => <div>Parent links</div>}));

const success = <T,>(data: T): ApiResponse<T> => ({
  status: 200,
  code: 'SUCCESS',
  data,
  message: 'Success',
  timestamp: '2026-08-31T10:40:00Z',
});

describe('TenantStudentRecordPage', () => {
  const renderRecord = (items: StudentIntakeResponse[] = []) => {
    vi.mocked(tenantAdvisingApiService.listStudentIntakes).mockResolvedValue(success({items, page: 0, size: 20, total: items.length}));
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
        <MemoryRouter initialEntries={[{pathname: '/admin/students/448', state: {returnTo: '/admin/intakes?q=Integration&page=2'}}]}>
          <Routes><Route path="/admin/students/:studentUserId" element={<TenantStudentRecordPage/>}/></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('uses the tenant user directory and keeps Parent links and list filters available', async () => {
    renderRecord();
    expect(await screen.findByText(/Integration Student/)).toBeInTheDocument();
    expect(screen.getByText('Parent links')).toBeInTheDocument();
    expect(adminApiService.getTenantUser).toHaveBeenCalledWith(448);
    expect(await screen.findByText('No intake record available')).toBeInTheDocument();
    expect(tenantAdvisingApiService.listStudentIntakes).toHaveBeenCalledWith({studentUserId: 448, page: 0, size: 20});
    expect(screen.getByRole('link', {name: 'Back to intakes'})).toHaveAttribute('href', '/admin/intakes?q=Integration&page=2');
  });

  it('never displays an intake returned for another student', async () => {
    renderRecord([{intakeId: 9, studentUserId: 999, courseRequest: 'Another student private context', lifecycleStatus: 'OPEN', assignmentStatus: 'UNASSIGNED', intakeVersion: 1}]);
    expect(await screen.findByText('No intake record available')).toBeInTheDocument();
    expect(screen.queryByText('Another student private context')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Assign advisor'})).not.toBeInTheDocument();
  });

  it('requires an explicit intake selection when more than one record exists', async () => {
    const base: StudentIntakeResponse = {intakeId: 9, studentUserId: 448, lifecycleStatus: 'OPEN', assignmentStatus: 'UNASSIGNED', intakeVersion: 1};
    renderRecord([{...base, courseRequest: 'Writing intake'}, {...base, intakeId: 10, courseRequest: 'Speaking intake'}]);
    const choice = await screen.findByRole('combobox', {name: 'Intake record'});
    expect(screen.queryByText('Writing intake')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Assign advisor'})).not.toBeInTheDocument();
    fireEvent.change(choice, {target: {value: '10'}});
    expect(screen.getByText('Speaking intake')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Assign advisor'})).toBeInTheDocument();
  });
});
