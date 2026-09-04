import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ParentLinksPanel} from './index';

const mocks = vi.hoisted(() => ({
  listCounsellorParentLinks: vi.fn(),
  createOrReuseParentLink: vi.fn(),
  linkExistingParent: vi.fn(),
  unlinkIntakeParent: vi.fn(),
  listAdvisorParentLinks: vi.fn(),
  listTenantParentLinks: vi.fn(),
  createOrReuseTenantParentLink: vi.fn(),
  linkTenantParent: vi.fn(),
  unlinkTenantParent: vi.fn(),
}));

vi.mock('@/apis/services/parent-api', () => ({parentApiService: mocks}));

const response = <T,>(data: T) => ({status: 200, code: 'SUCCESS', data, message: 'OK', timestamp: '2026-09-02T00:00:00Z'});

describe('Counsellor Parent links', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCounsellorParentLinks.mockResolvedValue(response([{linkId: 4, parentUserId: 91, parentFirstName: 'Pat', parentLastName: 'Parent', parentEmail: 'pat@example.test'}]));
    mocks.unlinkIntakeParent.mockResolvedValue(response(undefined));
  });

  it('reloads real linked parents and allows an in-scope unlink', async () => {
    const confirmUnlink = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirmUnlink);
    const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
    render(<QueryClientProvider client={client}><ParentLinksPanel scope="counsellor" subjectId={7}/></QueryClientProvider>);

    expect(await screen.findByText('Pat Parent')).toBeInTheDocument();
    expect(mocks.listCounsellorParentLinks).toHaveBeenCalledWith(7);
    fireEvent.click(screen.getByRole('button', {name: 'Unlink'}));
    expect(mocks.unlinkIntakeParent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Unlink'}));
    await waitFor(() => expect(mocks.unlinkIntakeParent).toHaveBeenCalledWith(7, 91, {}, expect.any(String)));
    expect(confirmUnlink).toHaveBeenCalledTimes(2);
  });

  it.each(['FORBIDDEN', 'ACCESS_DENIED'])('renders %s as a permission error, not an empty relationship', async code => {
    mocks.listCounsellorParentLinks.mockRejectedValue({code: 403, message: 'Request failed', details: {code}});
    const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});

    render(<QueryClientProvider client={client}><ParentLinksPanel scope="counsellor" subjectId={7}/></QueryClientProvider>);

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to use this feature.');
    expect(screen.queryByText('Pat Parent')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Parent email'})).not.toBeInTheDocument();
    expect(screen.queryByText('No parent or guardian linked')).not.toBeInTheDocument();
  });

  it('treats INVALID_TOKEN as an authentication failure rather than an empty relationship', async () => {
    mocks.listCounsellorParentLinks.mockRejectedValue({code: 401, message: 'Request failed', details: {code: 'INVALID_TOKEN'}});
    const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});

    render(<QueryClientProvider client={client}><ParentLinksPanel scope="counsellor" subjectId={7}/></QueryClientProvider>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired. Sign in again.');
    expect(screen.queryByRole('textbox', {name: 'Parent email'})).not.toBeInTheDocument();
    expect(screen.queryByText('No parent or guardian linked')).not.toBeInTheDocument();
  });
});
