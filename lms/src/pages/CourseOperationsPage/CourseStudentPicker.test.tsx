import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {describe, expect, it, vi} from 'vitest';
import {courseApiService} from '@/apis/services/course-api';
import {CourseStudentPicker} from './CourseStudentPicker';

vi.mock('@/apis/services/course-api', () => ({courseApiService: {listCourseMembers: vi.fn()}}));

describe('report student selection after member authorization changes', () => {
  it.each([403, 404])('hides the selector after HTTP %s', async code => {
    vi.mocked(courseApiService.listCourseMembers).mockRejectedValue({code});
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><CourseStudentPicker courseId={71} onSelect={vi.fn()}/></QueryClientProvider>);
    fireEvent.focus(screen.getByRole('combobox'));
    await screen.findByRole('alert');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    client.clear();
  });

  it('loads response-backed students through the existing paginated members API', async () => {
    vi.mocked(courseApiService.listCourseMembers).mockResolvedValue({status: 200, code: 'SUCCESS', message: '', timestamp: '2026-09-05T00:00:00Z', data: {items: [{id: 1, courseId: 71, userId: 26, userEmail: 'alex@example.test', userFirstName: 'Alex', userLastName: 'Chen', courseRole: 'Student', active: true}], total: 1, page: 0, size: 20}});
    const client = new QueryClient();
    const select = vi.fn();
    render(<QueryClientProvider client={client}><CourseStudentPicker courseId={71} onSelect={select}/></QueryClientProvider>);
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option'));
    await waitFor(() => expect(select).toHaveBeenCalledWith({id: 26, name: 'Alex Chen'}));
    expect(courseApiService.listCourseMembers).toHaveBeenLastCalledWith(71, {courseRole: 'Student', q: undefined, page: 0, size: 20});
    client.clear();
  });
});
