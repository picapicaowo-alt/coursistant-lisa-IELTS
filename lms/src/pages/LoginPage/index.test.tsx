import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  loginApi: vi.fn(),
  storeLogin: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock('@/apis/services/auth-api', () => ({
  authApiService: {login: mocks.loginApi},
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({login: mocks.storeLogin, user: null}),
}));

vi.mock('@/apis', () => ({
  AUTH_ERROR_CODES: {
    invalidCredentials: 'INVALID_CREDENTIALS',
    serviceUnavailable: 'AUTH_SERVICE_TEMPORARILY_UNAVAILABLE',
  },
  V2ApiClient: {setAccessToken: mocks.setAccessToken},
}));

vi.mock('@iconify/react', () => ({Icon: () => <span/>}));

const copy: Record<string, string> = {
  'login.title': 'Hi, Welcome back',
  'login.subtitle': 'Enter your details',
  'login.socialGoogle': 'Sign in with Google',
  'login.socialMicrosoft': 'Sign in with Microsoft',
  'login.socialLinkedIn': 'Sign in with Linkedin',
  'login.socialFacebook': 'Sign in with Facebook',
  'login.dividerText': 'Sign in with Coursistant',
  'login.emailLabel': 'Email',
  'login.passwordLabel': 'Password',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
  'login.emailPlaceholder': 'Enter email address',
  'login.passwordPlaceholder': 'Enter password',
  'login.rememberForDays': 'Remember for 30 days',
  'login.forgotPassword': 'Forgot password?',
  'login.logIn': 'Log in',
  'login.noAccount': 'No account?',
  'login.signUp': 'Sign up',
  'errors.invalidCredentials': 'Incorrect email or password.',
  'errors.serviceUnavailable': 'Sign-in is temporarily unavailable.',
  'errors.unexpected': 'Unexpected error.',
  'errors.passwordChangeRequired': 'Password change required.',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => copy[key] ?? key}),
}));

import LoginPage from './index';
import {getLoginErrorKind} from './loginErrors';

const response = (data: Record<string, unknown>) => ({
  status: 200,
  code: 'SUCCESS',
  message: 'Success',
  timestamp: '2026-08-17T00:00:00Z',
  data,
});

const renderLogin = () => render(
  <MemoryRouter initialEntries={['/login']}>
    <Routes>
      <Route path="/login" element={<LoginPage/>}/>
      <Route path="/" element={<div>User dashboard</div>}/>
      <Route path="/course" element={<div>Course administration</div>}/>
      <Route path="/counsellor" element={<div>Counsellor dashboard</div>}/>
      <Route path="/advisor/students" element={<div>Advisor queue</div>}/>
      <Route path="/admin/intakes" element={<div>Tenant intakes</div>}/>
    </Routes>
  </MemoryRouter>
);

const fillCredentials = async (email: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', {name: 'Email'}), email);
  await user.type(screen.getByLabelText('Password'), 'example-password');
  return user;
};

describe('LoginPage branding and sign-in method', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows the X-Learn hero while keeping email and password as the only sign-in method', () => {
    const {container} = renderLogin();

    expect(container.querySelector('img[src="/icons/figma-auth/dashboard.png"]')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Email'})).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /google|microsoft|linkedin|facebook/i})).not.toBeInTheDocument();
  });
});

describe('LoginPage account routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('logs student and instructor accounts through the USER table by default', async () => {
    mocks.loginApi.mockResolvedValue(response({
      userId: 385,
      email: 'regtest1@example.com',
      name: 'Alex Rivera',
      username: 'regtest1',
      role: 'USER',
      level: 'STUDENT',
      avatar: null,
      accessToken: 'token',
      mustChangePassword: false,
    }));
    renderLogin();
    const user = await fillCredentials(' regtest1@example.com ');

    await user.click(screen.getByRole('button', {name: 'Log in'}));

    expect(mocks.loginApi).toHaveBeenCalledWith({
      email: 'regtest1@example.com',
      password: 'example-password',
      role: 'USER',
    });
    expect(await screen.findByText('User dashboard')).toBeInTheDocument();
  });

  it('sends counsellor accounts to the intake dashboard', async () => {
    mocks.loginApi.mockResolvedValue(response({
      userId: 11,
      email: 'counsellor1@example.com',
      name: 'Counsellor',
      username: 'counsellor1',
      role: 'USER',
      level: 'COUNSELLOR',
      avatar: null,
      accessToken: 'token',
      mustChangePassword: false,
    }));
    renderLogin();
    const user = await fillCredentials('counsellor1@example.com');
    await user.click(screen.getByRole('button', {name: 'Log in'}));
    expect(await screen.findByText('Counsellor dashboard')).toBeInTheDocument();
  });

  it('resolves a platform admin without exposing account type in the UI', async () => {
    mocks.loginApi
      .mockRejectedValueOnce({code: 401, details: {code: 'INVALID_CREDENTIALS'}})
      .mockResolvedValueOnce(response({
        userId: 20,
        email: 'admin@example.com',
        name: 'Platform Admin',
        username: 'admin',
        role: 'SYSTEM_ADMIN',
        level: null,
        avatar: null,
        accessToken: 'admin-token',
      }));
    renderLogin();
    const user = userEvent.setup();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', {name: 'Email'}), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'example-password');

    await user.click(screen.getByRole('button', {name: 'Log in'}));

    expect(mocks.loginApi).toHaveBeenNthCalledWith(1, expect.objectContaining({role: 'USER'}));
    expect(mocks.loginApi).toHaveBeenNthCalledWith(2, expect.objectContaining({role: 'ADMIN'}));
    expect(await screen.findByText('Course administration')).toBeInTheDocument();
    expect(localStorage.getItem('preferredLoginRole')).toBe('ADMIN');
  });

  it('does not retry another account table for a network or server failure', async () => {
    mocks.loginApi.mockRejectedValue({code: 503});
    renderLogin();
    const user = await fillCredentials('regtest1@example.com');

    await user.click(screen.getByRole('button', {name: 'Log in'}));

    expect(mocks.loginApi).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Sign-in is temporarily unavailable.')).toBeInTheDocument();
  });
});

describe('getLoginErrorKind', () => {
  it('distinguishes credentials from temporary network/server failures', () => {
    expect(getLoginErrorKind({code: 401, details: {code: 'INVALID_CREDENTIALS'}})).toBe('credentials');
    expect(getLoginErrorKind({code: 0})).toBe('unavailable');
    expect(getLoginErrorKind({code: 503})).toBe('unavailable');
  });
});
