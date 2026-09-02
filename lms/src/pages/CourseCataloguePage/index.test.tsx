import '@testing-library/jest-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  browseCourses: vi.fn(),
  getMyCourses: vi.fn(),
  user: {id: 20, role: 'SYSTEM_ADMIN', level: null} as {
    id: number;
    role: 'SYSTEM_ADMIN' | 'TENANT_ADMIN';
    level: null | 'NOT_APPLICABLE';
  },
}));

vi.mock('@/contexts/RequiredAuthContext', () => ({
  useRequiredAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock('@/apis/services/course-api', () => ({
  courseApiService: {browseCourses: mocks.browseCourses},
}));

vi.mock('@/apis/services/dashboard-api', () => ({
  dashboardApiService: {getMyCourses: mocks.getMyCourses},
}));

vi.mock('./components/CoursePreview', () => ({
  CoursePreview: ({courseCode}: {courseCode: string}) => <div>{courseCode}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

import CourseCataloguePage from './index';

describe('CourseCataloguePage for platform administrators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {id: 20, role: 'SYSTEM_ADMIN', level: null};
  });

  it('uses the admin browse endpoint instead of the USER-only my-courses endpoint', async () => {
    mocks.browseCourses.mockResolvedValue({
      status: 200,
      code: 'SUCCESS',
      message: 'Success',
      timestamp: '2026-08-17T00:00:00Z',
      data: {
        items: [{
          id: 31,
          courseId: 31,
          tenantId: 1,
          courseCode: 'ADMIN-VISIBLE',
          title: 'Admin visible course',
          state: 'Active',
          instructorId: null,
          primaryInstructor: null,
        }],
        page: 0,
        size: 20,
        total: 1,
      },
    });
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><CourseCataloguePage/></MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('ADMIN-VISIBLE')).toBeInTheDocument();
    await waitFor(() => expect(mocks.browseCourses).toHaveBeenCalledWith({
      state: 'Active',
      page: 0,
      size: 20,
    }));
    expect(mocks.getMyCourses).not.toHaveBeenCalled();
  });

  it('redirects a tenant admin without attempting the forbidden course browse', async () => {
    mocks.user = {id: 21, role: 'TENANT_ADMIN', level: 'NOT_APPLICABLE'};
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/course']}>
          <Routes>
            <Route path="/course" element={<CourseCataloguePage/>}/>
            <Route path="/admin/intakes" element={<div>Tenant intake home</div>}/>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Tenant intake home')).toBeInTheDocument();
    expect(mocks.browseCourses).not.toHaveBeenCalled();
    expect(mocks.getMyCourses).not.toHaveBeenCalled();
  });
});
