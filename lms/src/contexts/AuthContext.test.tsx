import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AuthProvider, useAuth} from './AuthContext';

const mocks = vi.hoisted(() => ({
  clearAccessToken: vi.fn(),
  serverLogout: vi.fn(),
}));

vi.mock('@/apis', () => ({
  V2ApiClient: {
    clearAccessToken: mocks.clearAccessToken,
  },
}));

vi.mock('@/apis/services/auth-api', () => ({
  authApiService: {
    logout: mocks.serverLogout,
  },
}));

const storedUser = {
  id: 7,
  userId: 7,
  email: 'student@example.com',
  name: 'Student',
  username: 'student',
  role: 'USER',
  level: 'STUDENT',
  avatar: null,
  accessToken: 'sensitive-token',
};

const AuthHarness = () => {
  const {loading, login, logout, user} = useAuth();

  if (loading) return <span>Loading</span>;

  return (
    <div>
      <span>{user?.email ?? 'Signed out'}</span>
      <button type="button" onClick={() => void logout()}>Log out</button>
      <button type="button" onClick={() => login({...storedUser, email: "next@example.test", role: "USER", level: "STUDENT"})}>Switch account</button>
    </div>
  );
};

describe('AuthProvider logout', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(storedUser));
    localStorage.setItem('accToken', storedUser.accessToken);
    localStorage.setItem('account', JSON.stringify({token: true}));
    localStorage.setItem('unrelated-preference', 'keep-me');
    mocks.clearAccessToken.mockReset();
    mocks.serverLogout.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('clears user-relative queries and mutation history before switching identities', async () => {
    const client = new QueryClient();
    client.setQueryData(['me', 'progress'], {studentUserId: 7});
    client.getMutationCache().build(client, {mutationKey: ['private-feedback']});
    render(<QueryClientProvider client={client}><AuthProvider><AuthHarness/></AuthProvider></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', {name: 'Switch account'}));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(await screen.findByText('next@example.test')).toBeInTheDocument();
  });

  it('revokes the server session before clearing local authentication', async () => {
    mocks.serverLogout.mockResolvedValue({status: 200, data: null});

    render(
      <QueryClientProvider client={new QueryClient()}><AuthProvider>
        <AuthHarness/>
      </AuthProvider></QueryClientProvider>
    );

    expect(await screen.findByText(storedUser.email)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Log out'}));

    await waitFor(() => expect(mocks.serverLogout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.clearAccessToken).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('accToken')).toBeNull();
    expect(localStorage.getItem('account')).toBeNull();
    expect(localStorage.getItem('unrelated-preference')).toBe('keep-me');
  });

  it('still clears the browser session when the API is unavailable', async () => {
    mocks.serverLogout.mockRejectedValue(new Error('Bad gateway'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <QueryClientProvider client={new QueryClient()}><AuthProvider>
        <AuthHarness/>
      </AuthProvider></QueryClientProvider>
    );

    fireEvent.click(await screen.findByRole('button', {name: 'Log out'}));

    await waitFor(() => expect(mocks.clearAccessToken).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('accToken')).toBeNull();
  });
});
