import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {ReactNode} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import GroupSetDetailPage from '@/pages/GroupSetDetailPage';
import type {CourseGroupSet} from '@/apis/types/course';
import {courseApiService as api} from '@/apis/services/course-api';
import i18n from './index';
import {SUPPORTED_LOCALES} from './configuration';

const access = vi.hoisted(() => ({canManageGroups: true}));
vi.mock('@/hooks/useCourseAccess', () => ({useCourseAccess: () => access}));
vi.mock('@/apis/services/course-api', () => ({courseApiService: {
  listGroupSets: vi.fn(), createGroupSet: vi.fn(), getGroupSet: vi.fn(), listUngroupedStudents: vi.fn(), patchGroupSet: vi.fn(),
  createGroup: vi.fn(), batchCreateGroups: vi.fn(), patchGroup: vi.fn(), deleteGroup: vi.fn(), deleteGroupSet: vi.fn(),
  joinGroup: vi.fn(), leaveGroup: vi.fn(), switchGroup: vi.fn(), assignGroupMember: vi.fn(), moveGroupMember: vi.fn(), removeGroupMember: vi.fn(), distributeGroupsRandomly: vi.fn(),
}}));
const response = <T,>(data: T) => ({status: 200, code: 'SUCCESS', message: '', timestamp: '2026-09-04T12:00:00Z', data});
const membership = {groupId: 41, userId: 901, displayName: null, joinedAt: '2026-09-01T00:00:00Z', addedByType: 'INSTRUCTOR', addedByUserId: 71};
const groupSet: CourseGroupSet = {id: 9, courseId: 31, name: 'Authored group set', defaultCapacity: 5, joinOpensAtLocal: '2026-09-04T10:00:00', joinClosesAtLocal: '2026-09-10T10:00:00', timezone: 'Asia/Shanghai', locked: false, openForSelfService: true, myGroup: null, groups: [
  {id: 41, groupSetId: 9, name: 'Authored group A', capacity: 5, capacityOverride: null, memberCount: 1, members: [membership]},
  {id: 42, groupSetId: 9, name: 'Authored group B', capacity: 5, capacityOverride: null, memberCount: 0, members: []},
]};
const clients: QueryClient[] = [];
function mount(ui: ReactNode, path: string, entry: string) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false, retryDelay: 0, staleTime: Infinity}, mutations: {retry: false}}}); clients.push(client);
  return render(<MemoryRouter initialEntries={[entry]}><QueryClientProvider client={client}><Routes><Route path={path} element={ui}/></Routes></QueryClientProvider></MemoryRouter>);
}
const mountDetail = () => mount(<GroupSetDetailPage/>, '/course/:courseId/group-sets/:groupSetId', '/course/31/group-sets/9');
const button = (key: string) => screen.getByRole('button', {name: i18n.t(key)});
const cycle = async (check: () => void) => {for (const locale of SUPPORTED_LOCALES) {await act(() => i18n.changeLanguage(locale)); check(); expect(screen.getByRole('main').textContent).not.toMatch(/courseTools:|common:|Opaque diagnostic/);}};
beforeEach(async () => {
  vi.resetAllMocks(); access.canManageGroups = true; await i18n.changeLanguage('en');
  vi.mocked(api.listGroupSets).mockResolvedValue(response([groupSet])); vi.mocked(api.getGroupSet).mockResolvedValue(response(groupSet));
  vi.mocked(api.listUngroupedStudents).mockResolvedValue(response([{userId: 902, displayName: 'Authored student'}]));
});
afterEach(async () => {cleanup(); clients.splice(0).forEach(client => client.clear()); await i18n.changeLanguage('en');});

describe('course groups locale and contract boundaries', () => {
  it.each([404, 403])('offers a way back for an unavailable set (%s), without retries or dependent roster reads', async status => {
    vi.mocked(api.getGroupSet).mockRejectedValue({code: status, message: 'Opaque diagnostic'});
    mountDetail();
    await screen.findByRole('heading', {name: i18n.t(status === 404 ? 'courseTools:groups.setMissing' : 'courseTools:groups.setUnavailable')});
    await cycle(() => {
      expect(screen.getByRole('status')).toHaveTextContent(i18n.t(status === 404 ? 'courseTools:groups.setMissingHelp' : 'courseTools:groups.setForbiddenHelp'));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('link', {name: i18n.t('courseTools:groups.viewCurrent')})).toHaveAttribute('href', '/course/31/groups');
      expect(screen.queryByRole('button', {name: i18n.t('common:actions.tryAgain')})).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: i18n.t('courseTools:groups.addGroup')})).not.toBeInTheDocument();
    });
    expect(api.getGroupSet).toHaveBeenCalledTimes(1);
    expect(api.listUngroupedStudents).not.toHaveBeenCalled();
  });

  it('allows recovery from a temporary failure and loads the roster only after the set succeeds', async () => {
    vi.mocked(api.getGroupSet).mockRejectedValue({code: 503, message: 'Opaque diagnostic'});
    mountDetail();
    await screen.findByRole('alert');
    expect(api.listUngroupedStudents).not.toHaveBeenCalled();
    vi.mocked(api.getGroupSet).mockResolvedValue(response(groupSet));
    fireEvent.click(button('common:actions.tryAgain'));
    await screen.findByRole('heading', {name: groupSet.name});
    await waitFor(() => expect(api.listUngroupedStudents).toHaveBeenCalledTimes(1));
  });

});
