import '@/i18n';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import CounsellorAssignAdvisorPage from './index';

const mocks = vi.hoisted(() => ({getStudentIntake: vi.fn(), listAdvisors: vi.fn(), assignAdvisor: vi.fn()}));
vi.mock('@/apis/services/counsellor-api', () => ({counsellorApiService: mocks}));

const response = <T,>(data: T) => ({status: 200, code: 'SUCCESS', data, message: 'OK', timestamp: '2026-09-02T00:00:00Z'});

const renderPage = () => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/counsellor/intakes/7/assign']}><Routes><Route path="/counsellor/intakes/:intakeId/assign" element={<CounsellorAssignAdvisorPage/>}/><Route path="/counsellor/intakes" element={<p>Queue</p>}/></Routes></MemoryRouter></QueryClientProvider>);
};

describe('Counsellor advisor assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStudentIntake.mockResolvedValue(response({intakeId: 7, studentUserId: 41, firstName: 'Sam', lastName: 'Student', lifecycleStatus: 'OPEN', assignmentStatus: 'UNASSIGNED', intakeVersion: 3}));
    mocks.listAdvisors.mockResolvedValue(response({page: 0, size: 100, total: 2, items: [
      {advisorUserId: 51, firstName: 'Charlotte', lastName: 'Jones', email: 'charlotte@example.com', level: 'ADVISOR'},
      {advisorUserId: 52, firstName: 'Morgan', lastName: 'Lee', email: 'morgan@example.com', level: 'INSTRUCTOR_ADVISOR'},
    ]}));
  });

  it('loads the eligible directory and filters it by name or email', async () => {
    renderPage();
    expect(await screen.findByText('Charlotte Jones')).toBeInTheDocument();
    expect(mocks.listAdvisors).toHaveBeenCalledWith(0, 100);
    fireEvent.change(screen.getByLabelText('Search advisors by name or email'), {target: {value: 'charlotte@example.com'}});
    expect(await screen.findByText('Charlotte Jones')).toBeInTheDocument();
    expect(screen.queryByText('Morgan Lee')).not.toBeInTheDocument();
  });
});
