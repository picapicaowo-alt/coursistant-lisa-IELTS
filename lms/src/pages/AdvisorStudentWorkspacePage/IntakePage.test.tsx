import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {advisorApiService} from '@/apis/services/advisor-api';
import AdvisorStudentIntakePage from './IntakePage';

vi.mock('@/apis/services/advisor-api', () => ({
  advisorApiService: {
    getStudentIntake: vi.fn(),
  },
}));

describe('AdvisorStudentIntakePage', () => {
  it('does not retry a final hidden-not-found response', async () => {
    vi.mocked(advisorApiService.getStudentIntake).mockRejectedValue(new Error('not assigned'));
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: 3, retryDelay: 0}},
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/advisor/students/448/intake']}>
          <Routes>
            <Route path="/advisor/students/:studentUserId/intake" element={<AdvisorStudentIntakePage/>}/>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole('alert');
    await waitFor(() => expect(advisorApiService.getStudentIntake).toHaveBeenCalledTimes(1));
  });
});
