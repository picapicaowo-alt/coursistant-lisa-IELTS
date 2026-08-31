import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@testing-library/jest-dom';

const api = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}));
const auth = vi.hoisted(() => ({updateProfile: vi.fn()}));

vi.mock('@/apis/services/profile-api', () => ({profileApiService: api}));
vi.mock('@/contexts/AuthContext', () => ({useAuth: () => auth}));

import ProfilePage from './index';

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
      <ProfilePage/>
    </QueryClientProvider>
  );
};

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getMyProfile.mockResolvedValue(response(profile));
    api.updateMyProfile.mockResolvedValue(response({...profile, lastName: 'Two'}));
  });

  it('loads the live profile and saves split-name fields', async () => {
    renderPage();
    expect(await screen.findByRole('heading', {name: 'Student One'})).toBeInTheDocument();
    expect(screen.getByText('student@example.com')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Edit profile'}));
    const name = screen.getByLabelText('Last name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Two');
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    await waitFor(() => {
      expect(api.updateMyProfile).toHaveBeenCalledWith({firstName: 'Student', middleName: '', lastName: 'Two', phone: ''});
    });
    expect(await screen.findByText('Profile updated.')).toBeInTheDocument();
  });
});
