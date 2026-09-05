import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import CounsellorDashboardPage from './index';
import type {StudentIntakeResponse} from '@/apis';

const mocks = vi.hoisted(() => ({getDashboard: vi.fn(), listStudentIntakes: vi.fn(), getStudentIntake: vi.fn(), listAdvisors: vi.fn()}));
const parentMocks = vi.hoisted(() => ({listCounsellorParentLinks: vi.fn()}));
vi.mock('@/apis/services/counsellor-api', () => ({counsellorApiService: mocks}));
vi.mock('@/apis/services/parent-api', () => ({parentApiService: parentMocks}));

const response = <T,>(data: T) => ({status: 200, code: 'SUCCESS', data, message: 'OK', timestamp: '2026-09-02T00:00:00Z'});
const student: StudentIntakeResponse = {
  intakeId: 7, studentUserId: 41, firstName: 'Sam', lastName: 'Lee', email: 'sam@example.test',
  studentType: 'STANDARD', lifecycleStatus: 'OPEN', assignmentStatus: 'UNASSIGNED', intakeVersion: 3,
  courseRequest: 'IELTS Academic preparation', createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-02T12:00:00Z',
};
const secondStudent = {...student, intakeId: 8, firstName: 'Alex', courseRequest: 'GRE preparation'};

const renderPage = () => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  return render(<QueryClientProvider client={client}><MemoryRouter><CounsellorDashboardPage/></MemoryRouter></QueryClientProvider>);
};

describe('Counsellor dashboard interactions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getDashboard.mockResolvedValue(response({createdCount: 4, assignedCount: 2, unassignedCount: 1}));
    mocks.listStudentIntakes.mockResolvedValue(response({page: 0, size: 5, total: 1, items: [student]}));
    mocks.getStudentIntake.mockImplementation((id: number) => Promise.resolve(response(id === student.intakeId ? student : secondStudent)));
    mocks.listAdvisors.mockResolvedValue(response({page: 0, size: 3, total: 1, items: [{advisorUserId: 51, firstName: 'Ivy', lastName: 'Chen', email: 'ivy@example.test', level: 'ADVISOR'}]}));
    parentMocks.listCounsellorParentLinks.mockResolvedValue(response([]));
  });

  it('shows a retryable error for malformed pages without NaN pagination or a false empty queue', async () => {
    mocks.listStudentIntakes.mockResolvedValue(response([]));
    mocks.listAdvisors.mockResolvedValue(response({items: [], page: 0, size: 0, total: 0}));
    renderPage();
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText('No unassigned intakes')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Try again'})).toHaveLength(2);
  });

  it('keeps count explanations contextual and only links the available queue', async () => {
    renderPage();
    expect(await screen.findByRole('link', {name: /1 Unassigned/})).toHaveAttribute('href', '/counsellor/intakes');
    const help = screen.getByLabelText('About assigned count');
    expect(help.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(help);
    expect(help.closest('details')).toHaveAttribute('open');
    expect(screen.getByText(/Intake access transfers to the Advisor at handover/)).toBeVisible();
    expect(screen.queryByRole('link', {name: /^Assigned$/})).not.toBeInTheDocument();
    expect(screen.queryByText('About this count')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Counsellor workflow')).not.toBeInTheDocument();
  });

  it('connects the selected record, parents and advisor actions to existing routes', async () => {
    renderPage();
    expect(await screen.findByText('IELTS Academic preparation')).toBeVisible();
    expect(await screen.findByText('No parent or guardian linked')).toBeVisible();
    expect(screen.getByRole('link', {name: 'Create student'})).toHaveAttribute('href', '/counsellor/intakes/new');
    expect(screen.getByRole('link', {name: 'Edit intake'})).toHaveAttribute('href', '/counsellor/intakes/7');
    expect(screen.getByRole('link', {name: 'Manage'})).toHaveAttribute('href', '/counsellor/intakes/7');
    expect(screen.getByRole('link', {name: 'Select advisor'})).toHaveAttribute('href', '/counsellor/intakes/7/assign');
    expect(screen.getByText('Ivy Chen')).toBeVisible();
    expect(mocks.listStudentIntakes).toHaveBeenCalledWith(0, 5);
    expect(mocks.listAdvisors).toHaveBeenCalledWith(0, 3);
    expect(parentMocks.listCounsellorParentLinks).toHaveBeenCalledWith(7);
  });

  it('does not retain another student or parent while a new selection loads', async () => {
    mocks.listStudentIntakes.mockResolvedValue(response({page: 0, size: 5, total: 2, items: [student, secondStudent]}));
    parentMocks.listCounsellorParentLinks.mockResolvedValue(response([{parentUserId: 70, parentFirstName: 'Pat', parentLastName: 'Lee'}]));
    mocks.getStudentIntake.mockImplementation((id: number) => id === student.intakeId ? Promise.resolve(response(student)) : new Promise(() => {}));
    renderPage();
    expect(await screen.findByText('Pat Lee')).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: /Alex Lee/}));
    expect(await screen.findByText('Loading intake…')).toBeVisible();
    const preview = within(screen.getByRole('region', {name: 'Intake preview'}));
    expect(preview.queryByText('IELTS Academic preparation')).not.toBeInTheDocument();
    expect(preview.queryByText('Pat Lee')).not.toBeInTheDocument();
    expect(preview.queryByRole('link', {name: 'Select advisor'})).not.toBeInTheDocument();
  });

  it('uses server pagination and selects a record from the new page', async () => {
    mocks.listStudentIntakes.mockImplementation((page: number, size: number) => Promise.resolve(response({page, size, total: 6, items: page === 0 ? [student] : [secondStudent]})));
    renderPage();
    await screen.findByText('IELTS Academic preparation');
    fireEvent.click(within(screen.getByRole('navigation', {name: 'intake pages'})).getByRole('button', {name: 'Next page'}));
    expect(await screen.findByText('GRE preparation')).toBeVisible();
    expect(mocks.listStudentIntakes).toHaveBeenLastCalledWith(1, 5);
    expect(screen.getByRole('link', {name: 'Select advisor'})).toHaveAttribute('href', '/counsellor/intakes/8/assign');
  });

  it('preserves Parent Link permission errors instead of showing an empty relationship', async () => {
    parentMocks.listCounsellorParentLinks.mockRejectedValue({code: 403, details: {code: 'ACCESS_DENIED'}});
    renderPage();
    expect(await screen.findByText('You do not have permission to use this feature.')).toBeVisible();
    expect(screen.queryByText('No parent or guardian linked')).not.toBeInTheDocument();
    expect(parentMocks.listCounsellorParentLinks).toHaveBeenCalledTimes(1);
  });

  it('refreshes the queue after access closes without retrying the handed-over detail', async () => {
    mocks.listStudentIntakes.mockResolvedValueOnce(response({page: 0, size: 5, total: 1, items: [student]}))
      .mockResolvedValue(response({page: 0, size: 5, total: 0, items: []}));
    mocks.getStudentIntake.mockRejectedValue({code: 404, details: {code: 'STUDENT_INTAKE_NOT_FOUND'}});
    renderPage();
    expect(await screen.findByText('No unassigned intakes')).toBeVisible();
    expect(mocks.getStudentIntake).toHaveBeenCalledTimes(1);
    expect(parentMocks.listCounsellorParentLinks).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', {name: 'Select advisor'})).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.getDashboard).toHaveBeenCalledTimes(2));
  });

  it('allows queue work even when aggregate counts fail, without inventing zero counts', async () => {
    mocks.getDashboard.mockRejectedValue(new Error('Counts temporarily unavailable'));
    renderPage();
    expect(await screen.findByText('Counts temporarily unavailable')).toBeVisible();
    expect(await screen.findByText('IELTS Academic preparation')).toBeVisible();
    expect(screen.queryByRole('link', {name: /0 Unassigned/})).not.toBeInTheDocument();
  });
});
