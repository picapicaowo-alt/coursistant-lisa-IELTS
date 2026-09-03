import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {StudyPlanHistory} from './StudyPlanHistory';

const list = vi.hoisted(() => vi.fn());
vi.mock('@/apis/services/advisor-api', () => ({advisorApiService: {listStudyPlanRevisions: list}}));
const response = (items: unknown[], total = items.length) => ({status: 200, code: 'SUCCESS', data: {items, total, page: 0, size: 20}});
const mount = () => render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><StudyPlanHistory studentUserId={301}/></QueryClientProvider>);
const reveal = (title: string) => {
  const summary = document.querySelector(`summary[aria-label="${title}"]`);
  const section = summary?.parentElement;
  if (!(section instanceof HTMLDetailsElement)) throw new Error(`Missing section ${title}`);
  section.open = true;
};

beforeEach(() => list.mockReset());

describe('study plan version history', () => {
  it('renders returned nested snapshot values including version zero, false and empty collections', async () => {
    list.mockResolvedValue(response([{entityVersion: 0, action: 'STUDY_PLAN_CREATED', snapshot: {strategySummary: 'Original writing strategy', basedOnProfileVersion: 0, approved: false, checkpoints: [{description: 'First diagnostic', tasks: [{title: 'Original task'}]}], notes: [], optionalNote: null}}]));
    mount();
    await screen.findByText('Version 0');
    reveal('Version history'); reveal('Version 0');
    expect(screen.getByText('Original writing strategy')).toBeVisible();
    expect(screen.getByText('First diagnostic')).toBeVisible();
    expect(screen.getByText('Original task')).toBeVisible();
    expect(screen.getByText('0', {exact: true})).toBeVisible();
    expect(screen.getByText('No', {exact: true})).toBeVisible();
    expect(screen.getByText('No items')).toBeVisible();
    expect(screen.getByText('Not recorded')).toBeVisible();
  });

  it('distinguishes revisions without saved content from an empty revision list', async () => {
    list.mockResolvedValue(response([{entityVersion: 2}]));
    mount();
    await screen.findByText('Version 2');
    reveal('Version history'); reveal('Version 2');
    expect(screen.getByText(/saved content for this version was not included/)).toBeVisible();
    expect(screen.queryByText('No saved revisions were returned.')).not.toBeInTheDocument();
  });

  it('shows a retryable failure instead of claiming there is no history', async () => {
    list.mockRejectedValueOnce(new Error('History unavailable')).mockResolvedValueOnce(response([]));
    mount();
    reveal('Version history');
    await screen.findByRole('alert');
    expect(screen.queryByText('No saved revisions were returned.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry history'}));
    await screen.findByText('No saved revisions were returned.');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('loads older server pages with the same student scope', async () => {
    list.mockResolvedValueOnce(response([{entityVersion: 20}], 21)).mockResolvedValueOnce(response([{entityVersion: 0, snapshot: {strategySummary: 'First saved plan'}}], 21));
    mount();
    await screen.findByText('Version 20');
    reveal('Version history');
    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(301, 1, 20));
    await screen.findByText('Version 0');
    expect(screen.queryByText('Version 20')).not.toBeInTheDocument();
  });
});
