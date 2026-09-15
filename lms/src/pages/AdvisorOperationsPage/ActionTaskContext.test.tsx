import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {advisorApiService} from '@/apis/services/advisor-api';
import type {AdvisorActionTaskResponse} from '@/apis/types/advising';
import {ActionTaskContext} from './ActionTaskContext';

vi.mock('@/apis/services/advisor-api', () => ({advisorApiService: {getStudentHub: vi.fn(), getStudyPlan: vi.fn()}}));
const task: AdvisorActionTaskResponse = {studentUserId: 42, target: {studentUserId: 42, resourceType: 'ADVISOR_TASK', advisorTaskId: 7}};
function renderTask(value = task) {
  return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><MemoryRouter><ActionTaskContext task={value}/></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(advisorApiService.getStudentHub).mockResolvedValue({status: 200, code: 'SUCCESS', message: 'Success', timestamp: '2026-09-15T00:00:00Z', data: {studentUserId: 42, firstName: 'Mina', lastName: 'Lee', studentType: 'STANDARD', activeCourseCount: 1}});
  vi.mocked(advisorApiService.getStudyPlan).mockResolvedValue({status: 200, code: 'SUCCESS', message: 'Success', timestamp: '2026-09-15T00:00:00Z', data: {studentUserId: 42, profileContext: {}, plan: {checkpoints: [{id: 2, tasks: [{id: 7, title: 'Review writing feedback', status: 'IN_PROGRESS', dueDate: '2026-09-09'}]}]}}});
});
it('shows who needs help, the exact learning task, and the selected student conversation link', async () => {
  renderTask();
  expect(await screen.findByRole('link', {name: 'Mina Lee'})).toHaveAttribute('href', '/advisor/students/42');
  expect(screen.getByRole('link', {name: 'Message student'})).toHaveAttribute('href', '/advisor/messages?studentUserId=42');
  expect(await screen.findByText('Review writing feedback')).toBeVisible();
  expect(screen.getByText('Learning task: In progress')).toBeVisible();
  expect(screen.getByText('Student learning task · Record #7')).toBeVisible();
});
it('retains student identity and contact actions when name lookup fails', async () => {
  vi.mocked(advisorApiService.getStudentHub).mockRejectedValue(new Error('unavailable'));
  renderTask({studentUserId: 42});
  expect(await screen.findByRole('button', {name: 'Retry student name'})).toBeVisible();
  expect(screen.getByRole('link', {name: 'Student #42'})).toHaveAttribute('href', '/advisor/students/42');
});
it('does not fetch or link an ambiguous student', () => {
  renderTask({...task, studentUserId: 99});
  expect(screen.getByText('Student information is unavailable.')).toBeVisible();
  expect(screen.queryByRole('link')).toBeNull();
  expect(advisorApiService.getStudentHub).not.toHaveBeenCalled();
  expect(advisorApiService.getStudyPlan).not.toHaveBeenCalled();
});
