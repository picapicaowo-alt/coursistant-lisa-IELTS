import {MemoryRouter} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@testing-library/jest-dom';

const profileApi = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
}));
const authApi = vi.hoisted(() => ({changePassword: vi.fn()}));
const auth = vi.hoisted(() => ({updateProfile: vi.fn()}));

vi.mock('@/apis/services/profile-api', () => ({profileApiService: profileApi}));
vi.mock('@/apis/services/auth-api', () => ({authApiService: authApi}));
vi.mock('@/contexts/AuthContext', () => ({useAuth: () => auth}));

import SettingsPage from './index';

const response = <T,>(data: T) => ({
  status: 200,
  code: 'SUCCESS',
  message: 'OK',
  timestamp: '2026-08-19T00:00:00Z',
  data,
});

const profile = {
  userId: 9,
  firstName: 'Student',
  lastName: 'One',
  email: 'student@example.com',
  role: 'USER',
  level: 'STUDENT',
  avatarUrl: null,
  phone: null,
  emailNotifications: true,
};

const renderPage = () => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SettingsPage/>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileApi.getMyProfile.mockResolvedValue(response(profile));
    authApi.changePassword.mockResolvedValue(response(null));
  });

  it('rejects a password that would fail the backend letter-and-digit rule', async () => {
    renderPage();
    expect(await screen.findByLabelText('First name')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', {name: 'Password'}));
    await userEvent.type(screen.getByLabelText('Current password'), 'OldPassw0rd');
    await userEvent.type(screen.getByLabelText('New password'), 'passwordonly');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'passwordonly');
    await userEvent.click(screen.getByRole('button', {name: 'Update password'}));
    expect(await screen.findByText('Use at least 8 characters with both letters and numbers.')).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('updates a valid password through the authenticated change-password route', async () => {
    renderPage();
    await screen.findByLabelText('First name');
    await userEvent.click(screen.getByRole('tab', {name: 'Password'}));
    await userEvent.type(screen.getByLabelText('Current password'), 'OldPassw0rd');
    await userEvent.type(screen.getByLabelText('New password'), 'NewPassw0rd');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewPassw0rd');
    await userEvent.click(screen.getByRole('button', {name: 'Update password'}));
    await waitFor(() => {
      expect(authApi.changePassword).toHaveBeenCalledWith(
        {
          currentPassword: 'OldPassw0rd',
          newPassword: 'NewPassw0rd',
        },
        expect.any(String),
      );
    });
  });

  it('toggles password visibility for all password fields', async () => {
    renderPage();
    await screen.findByLabelText('First name');
    await userEvent.click(screen.getByRole('tab', {name: 'Password'}));

    const currentInput = screen.getByLabelText('Current password');
    const newInput = screen.getByLabelText('New password');
    const confirmInput = screen.getByLabelText('Confirm new password');

    expect(currentInput).toHaveAttribute('type', 'password');
    expect(newInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('type', 'password');

    const toggleCurrent = screen.getByRole('button', {name: 'Show current password'});
    const toggleNew = screen.getByRole('button', {name: 'Show new password'});
    const toggleConfirm = screen.getByRole('button', {name: 'Show confirm password'});

    await userEvent.click(toggleCurrent);
    expect(currentInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', {name: 'Hide current password'})).toBeInTheDocument();

    await userEvent.click(toggleNew);
    expect(newInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', {name: 'Hide new password'})).toBeInTheDocument();

    await userEvent.click(toggleConfirm);
    expect(confirmInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', {name: 'Hide confirm password'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Hide current password'}));
    expect(currentInput).toHaveAttribute('type', 'password');
  });

  it('renders the back button in settings header', async () => {
    renderPage();
    const backButton = await screen.findByRole('button', {name: 'Back'});
    expect(backButton).toBeInTheDocument();
  });
});
