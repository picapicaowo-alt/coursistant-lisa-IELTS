import React from 'react';
import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {ApiResponse} from '@/apis';
import {tenantAdvisingApiService} from '@/apis/services/tenant-advising-api';
import TenantStudentRecordPage from './index';

vi.mock('@/apis/services/tenant-advising-api', () => ({
  tenantAdvisingApiService: {
    getStudentProfile: vi.fn(),
    getStudentStudyPlan: vi.fn(),
    listStudyPlanRevisions: vi.fn(),
  },
}));

const success = <T,>(data: T): ApiResponse<T> => ({
  status: 200,
  code: 'SUCCESS',
  data,
  message: 'Success',
  timestamp: '2026-08-26T10:40:00Z',
});

describe('TenantStudentRecordPage', () => {
  it('shows immutable study-plan revisions without advisor private notes', async () => {
    vi.mocked(tenantAdvisingApiService.getStudentProfile).mockResolvedValue(success({
      profileId: 1,
      studentUserId: 448,
      name: 'Integration Student',
      advisorUserId: 443,
      targetGoal: 'IELTS 7.0',
      profileVersion: 1,
    }));
    vi.mocked(tenantAdvisingApiService.getStudentStudyPlan).mockResolvedValue(success({
      studentUserId: 448,
      profileContext: {currentProfileVersion: 1},
      plan: {
        studyPlanId: 1,
        strategySummary: 'Weekly writing practice',
        studyPlanVersion: 2,
        basedOnProfileVersion: 1,
      },
    }));
    vi.mocked(tenantAdvisingApiService.listStudyPlanRevisions).mockResolvedValue(success({
      page: 0,
      size: 20,
      total: 1,
      items: [{
        entityVersion: 2,
        action: 'STUDY_PLAN_UPDATED',
        createdAt: '2026-08-26T10:40:00Z',
        actorId: 443,
      }],
    }));
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/students/448']}>
          <Routes>
            <Route path="/admin/students/:studentUserId" element={<TenantStudentRecordPage/>}/>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/STUDY_PLAN_UPDATED · v2/)).toBeInTheDocument();
    expect(tenantAdvisingApiService.listStudyPlanRevisions).toHaveBeenCalledWith(448, 0, 20);
    expect(screen.queryByText(/private note value/i)).not.toBeInTheDocument();
  });
});
