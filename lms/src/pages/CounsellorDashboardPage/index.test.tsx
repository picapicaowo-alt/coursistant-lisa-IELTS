import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import CounsellorDashboardPage from './index';

const mocks = vi.hoisted(() => ({getDashboard: vi.fn()}));
vi.mock('@/apis/services/counsellor-api', () => ({counsellorApiService: mocks}));

const response = <T,>(data: T) => ({status: 200, code: 'SUCCESS', data, message: 'OK', timestamp: '2026-09-02T00:00:00Z'});

const renderPage = () => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  return render(<QueryClientProvider client={client}><MemoryRouter><CounsellorDashboardPage/></MemoryRouter></QueryClientProvider>);
};

describe('Counsellor dashboard interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDashboard.mockResolvedValue(response({createdCount: 4, assignedCount: 2, unassignedCount: 1}));
  });

  it('explains assigned access without pretending that assigned records are readable', async () => {
    renderPage();
    const assigned = await screen.findByRole('button', {name: /2 Assigned/});
    fireEvent.click(assigned);
    expect(screen.getByText('Assigned means the handover is complete')).toBeInTheDocument();
    expect(screen.getByText(/backend removes assigned intakes from Counsellor access immediately/i)).toBeInTheDocument();
  });

  it('links the actionable unassigned count to the queue', async () => {
    renderPage();
    expect(await screen.findByRole('link', {name: /1 Unassigned/})).toHaveAttribute('href', '/counsellor/intakes');
    expect(screen.getByRole('link', {name: 'Create student'})).toHaveAttribute('href', '/counsellor/intakes/new');
  });
});
