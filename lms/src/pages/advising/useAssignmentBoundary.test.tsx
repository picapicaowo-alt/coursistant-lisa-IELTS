import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {describe, expect, it} from 'vitest';
import {useAssignmentBoundary} from './useAssignmentBoundary';

function Workspace() {
  useAssignmentBoundary(41);
  return <p>Student workspace</p>;
}

function setup() {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/advisor/students/41/support']}><Routes>
    <Route path="/advisor/students/41/support" element={<Workspace/>}/>
    <Route path="/advisor/students" element={<p>Assigned student queue</p>}/>
  </Routes></MemoryRouter></QueryClientProvider>);
  return client;
}

describe('Advisor assignment boundary', () => {
  it('leaves the workspace and clears student queries when a conversation becomes unavailable', async () => {
    const client = setup();
    await act(async () => {
      await client.fetchQuery({queryKey: ['advisor', 'student-conversation', 41], meta: {advisingStudentId: 41}, queryFn: () => Promise.reject({code: 404, details: {code: 'CONVERSATION_NOT_FOUND'}})}).catch(() => undefined);
    });
    expect(await screen.findByText('Assigned student queue')).toBeInTheDocument();
    await waitFor(() => expect(client.getQueryCache().findAll({predicate: query => query.meta?.advisingStudentId === 41})).toHaveLength(0));
  });
  it('keeps legitimate first-use missing profiles inside the assigned student workspace', async () => {
    const client = setup();
    await act(async () => {
      await client.fetchQuery({queryKey: ['advisor', 'profile', 41], meta: {advisingStudentId: 41}, queryFn: () => Promise.reject({code: 404, details: {code: 'STUDENT_PROFILE_NOT_FOUND'}})}).catch(() => undefined);
    });
    expect(screen.getByText('Student workspace')).toBeInTheDocument();
  });
});
