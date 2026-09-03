import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ProfilePage from './ProfilePage';
import StudyPlanPage from './StudyPlanPage';
import {advisingQueryKeys} from '../advising/queryKeys';

const api = vi.hoisted(() => ({getStudentProfile: vi.fn(), updateStudentProfile: vi.fn(), getStudyPlan: vi.fn(), listStudyPlanRevisions: vi.fn(), updateStudyPlan: vi.fn()}));
vi.mock('@/apis/services/advisor-api', () => ({advisorApiService: api}));
const response = <T,>(data: T) => ({code: 'SUCCESS', status: 200, data});
const profile = {studentUserId: 301, profileVersion: 2, targetGoal: 'Original target', skills: [{skillCode: 'WR', displayName: 'Writing', scale: 'IELTS', position: 1}]};
const plan = {profileContext: {currentProfileVersion: 2}, plan: {studyPlanVersion: 3, basedOnProfileVersion: 2, strategySummary: 'Original strategy', startDate: '2026-09-01', planEndDate: '2026-12-01', checkpoints: []}};
const mount = (element: React.ReactElement) => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/students/301']}><Routes><Route path="/students/:studentUserId" element={element}/></Routes></MemoryRouter></QueryClientProvider>);
  return client;
};

describe('reviewed draft versions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getStudentProfile.mockResolvedValue(response(profile));
    api.getStudyPlan.mockResolvedValue(response(plan));
    api.listStudyPlanRevisions.mockResolvedValue(response({items: [], total: 0}));
    api.updateStudentProfile.mockResolvedValue(response(profile));
    api.updateStudyPlan.mockResolvedValue(response(plan));
  });
  it('does not submit an old profile draft using a background-refreshed version', async () => {
    const client = mount(<ProfilePage/>);
    const field = await screen.findByLabelText('Target goal');
    await waitFor(() => expect(field).toHaveValue('Original target'));
    fireEvent.change(field, {target: {value: 'My unsaved target'}});
    act(() => client.setQueryData(advisingQueryKeys.advisorProfile(301), {...profile, profileVersion: 9, targetGoal: 'Concurrent change'}));
    fireEvent.submit(field.closest('form')!);
    await waitFor(() => expect(api.updateStudentProfile).toHaveBeenCalled());
    expect(api.updateStudentProfile.mock.calls[0][1]).toMatchObject({expectedProfileVersion: 2, targetGoal: 'My unsaved target'});
  });
  it('pins both plan and profile versions while editing a study plan', async () => {
    const client = mount(<StudyPlanPage/>);
    fireEvent.click(await screen.findByRole('button', {name: 'Edit study plan'}));
    const field = await screen.findByLabelText(/Strategy/);
    await waitFor(() => expect(field).toHaveValue('Original strategy'));
    fireEvent.change(field, {target: {value: 'My revised strategy'}});
    act(() => client.setQueryData(advisingQueryKeys.advisorStudyPlan(301), {profileContext: {currentProfileVersion: 10}, plan: {...plan.plan, studyPlanVersion: 8, strategySummary: 'Concurrent plan'}}));
    fireEvent.submit(field.closest('form')!);
    await waitFor(() => expect(api.updateStudyPlan).toHaveBeenCalled());
    expect(api.updateStudyPlan.mock.calls[0][1]).toMatchObject({expectedProfileVersion: 2, expectedStudyPlanVersion: 3, strategySummary: 'My revised strategy'});
  });
});
