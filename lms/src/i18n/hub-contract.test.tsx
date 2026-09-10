import {act, cleanup, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {ReactNode} from 'react';
import {afterEach, beforeEach, it, expect, vi} from 'vitest';
import {advisorApiService as api} from '@/apis/services/advisor-api';
import AdvisorStudentLayout from '@/pages/AdvisorStudentWorkspacePage';
import i18n from './index';
import {SUPPORTED_LOCALES} from './configuration';
import {formatNumber} from './formatting';
vi.mock('@/apis/services/advisor-api', () => ({advisorApiService: {getStudentProfile: vi.fn(), getStudentHub: vi.fn(), getStudyPlan: vi.fn()}}));
vi.mock('@/components/UserAvatar', () => ({UserAvatar: () => null}));
const response = <T,>(data: T) => ({status: 200, code: 'SUCCESS', message: '', timestamp: '2026-09-09T12:00:00Z', data});
const clients: QueryClient[] = [];
function mount(ui: ReactNode) {
 const client = new QueryClient({defaultOptions: {queries: {retry: false}}}); clients.push(client);
 render(<MemoryRouter initialEntries={['/students/301']}><QueryClientProvider client={client}><Routes><Route path="/students/:studentUserId" element={ui}/></Routes></QueryClientProvider></MemoryRouter>);
}
const cycle = async (check: () => void) => {for (const locale of SUPPORTED_LOCALES) {await act(() => i18n.changeLanguage(locale)); check();}};
beforeEach(async () => {vi.resetAllMocks(); await i18n.changeLanguage('en'); vi.mocked(api.getStudentProfile).mockResolvedValue(response({studentUserId: 301, profileId: 1, profileVersion: 1})); vi.mocked(api.getStudyPlan).mockRejectedValue({code: 404, details: {code: 'STUDY_PLAN_NOT_FOUND'}});});
afterEach(async () => {cleanup(); clients.splice(0).forEach(client => client.clear()); await i18n.changeLanguage('en');});
it.each(['STUDENT_INTAKE_NOT_FOUND', 'STUDY_PLAN_NOT_FOUND'])('shows the specific hub error %s across locale changes', async code => {
  vi.mocked(api.getStudentHub).mockRejectedValue({code: 404, details: {code}});
  mount(<AdvisorStudentLayout/>);
  await screen.findByRole('alert');
  await cycle(() => expect(screen.getByRole('alert')).toHaveTextContent(i18n.t(code === 'STUDENT_INTAKE_NOT_FOUND' ? 'advising:studentWorkspace.intakeMissing' : 'advising:studentWorkspace.studyPlanUnavailable')));
  expect(api.getStudentProfile).not.toHaveBeenCalled();
});

it.each(['VIP', 'STANDARD'] as const)('renders hub student type %s and zero active courses without inferring profile data', async studentType => {
  vi.mocked(api.getStudentHub).mockResolvedValue(response({studentUserId: 301, studentType, activeCourseCount: 0}));
  mount(<AdvisorStudentLayout/>);
  await screen.findByText(i18n.t(`common:status.${studentType}`));
  await cycle(() => {
    expect(screen.getByText(i18n.t(`common:status.${studentType}`))).toBeVisible();
    expect(screen.getByText(i18n.t('dashboard:activeCourses')).nextElementSibling).toHaveTextContent(formatNumber(0));
  });
});
