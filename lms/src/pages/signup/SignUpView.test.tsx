import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  sendVerification: vi.fn(),
  storeLogin: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock('@/apis/services/auth-api', () => ({
  authApiService: {
    register: mocks.register,
    sendRegistrationVerification: mocks.sendVerification,
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({login: mocks.storeLogin}),
}));

vi.mock('@/apis', () => ({
  AUTH_ERROR_CODES: {
    invalidPasswordFormat: 'INVALID_PASSWORD_FORMAT',
    invalidVerificationCode: 'INVALID_VERIFICATION_CODE',
    verificationCodeExpired: 'VERIFICATION_CODE_EXPIRED',
    verificationAttemptsExceeded: 'VERIFICATION_ATTEMPTS_EXCEEDED',
    verificationResendCooldown: 'VERIFICATION_RESEND_COOLDOWN',
    verificationHourlyLimit: 'VERIFICATION_HOURLY_LIMIT',
  },
  V2ApiClient: {setAccessToken: mocks.setAccessToken},
}));

vi.mock('@iconify/react', () => ({Icon: () => <span/>}));

const copy: Record<string, string> = {
  'signup.title': 'Create an account',
  'signup.subtitle': 'Enter your details',
  'signup.firstNameLabel': 'First name',
  'signup.middleNameLabel': 'Middle name',
  'signup.lastNameLabel': 'Last name',
  'signup.tenantIdLabel': 'Institution ID',
  'signup.emailLabel': 'Email',
  'signup.passwordLabel': 'Password',
  'signup.confirmPasswordLabel': 'Confirm password',
  'signup.activateButton': 'Activate account',
  'signupErrors.passwordMismatch': 'Passwords must match.',
  'signup.verificationLabel': 'Verification code',
  'signup.firstNamePlaceholder': 'Enter first name',
  'signup.middleNamePlaceholder': 'Enter middle name',
  'signup.lastNamePlaceholder': 'Enter last name',
  'signup.tenantIdPlaceholder': 'Enter institution ID',
  'signup.emailPlaceholder': 'Enter email',
  'signup.passwordPlaceholder': 'Enter password',
  'signup.passwordHint': 'Password help',
  'signup.verificationPlaceholder': 'Enter code',
  'signup.verifyEmail': 'Verify Email',
  'signup.verifyTime': 'Retry {{time}}',
  'signup.sendingCode': 'Sending...',
  'signup.creatingAccount': 'Creating account...',
  'signup.continueButton': 'Continue',
  'signup.alreadyRegistered': 'Already registered?',
  'signup.signinLink': 'Sign in',
  'signupErrors.firstNameRequired': 'First name is required.',
  'signupErrors.lastNameRequired': 'Last name is required.',
  'signupErrors.tenantIdRequired': 'Institution ID is required.',
  'signupErrors.emailRequired': 'Email is required.',
  'signupErrors.emailInvalid': 'Email is invalid.',
  'signupErrors.passwordRequired': 'Password is required.',
  'signupErrors.passwordFormat': 'Password format is invalid.',
  'signupErrors.verificationRequired': 'Code is required.',
  'signupErrors.verificationCodeFormat': 'Code must have six digits.',
  'signupErrors.verificationCodeSent': 'Code sent.',
  'signupErrors.verificationFailed': 'Code is incorrect.',
  'signupErrors.verificationExpired': 'Code expired.',
  'signupErrors.verificationAttemptsExceeded': 'Too many attempts.',
  'signupErrors.resendCooldown': 'Wait before resending.',
  'signupErrors.hourlyLimit': 'Hourly limit reached.',
  'signupErrors.sendVerificationFailed': 'Could not send code.',
  'signupErrors.signupFailed': 'Could not register.',
  'signupErrors.serviceUnavailable': 'Registration unavailable.',
  'login.hidePassword': 'Hide password',
  'login.showPassword': 'Show password',
};

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: (namespace = 'auth') => ({
    i18n,
    t: (key: string, variables?: {time?: string}) => {
      if (namespace !== 'auth') return i18n.t(key, {ns: namespace});
      const value = copy[key] ?? key;
      return variables?.time ? value.replace('{{time}}', variables.time) : value;
    },
  }),
}));

import SignUpView from './SignUpView';

const authResponse = {
  status: 200,
  code: 'SUCCESS',
  message: 'Success',
  timestamp: '2026-08-18T00:00:00Z',
  data: {
    userId: 9,
    email: 'student@example.com',
    name: 'Student One',
    username: 'student',
    role: 'USER',
    level: 'STUDENT',
    avatar: null,
    accessToken: 'registered-token',
  },
};

const renderSignup = () => render(
  <MemoryRouter initialEntries={['/signup']}>
    <Routes>
      <Route path="/signup" element={<SignUpView/>}/>
      <Route path="/" element={<div>Student dashboard</div>}/>
    </Routes>
  </MemoryRouter>
);

const fillRegistration = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Institution ID'), '1');
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.click(screen.getByRole('button', {name: 'Continue'}));
  await user.type(screen.getByLabelText('First name'), 'Student');
  await user.type(screen.getByLabelText('Last name'), 'One');

  await user.type(screen.getByLabelText('Password'), 'Passw0rd1');
  await user.type(screen.getByLabelText('Confirm password'), 'Passw0rd1');
  await user.click(screen.getByRole('button', {name: 'Continue'}));
  await user.type(screen.getByLabelText('Verification code'), '123456');
  return user;
};

describe('SignUpView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.sendVerification.mockResolvedValue({status: 200, data: null});
    mocks.register.mockResolvedValue(authResponse);
  });

  it('sends a code and creates an authenticated student account', async () => {
    renderSignup();
    const user = await fillRegistration();

    await user.click(screen.getByRole('button', {name: 'Verify Email'}));
    expect(mocks.sendVerification).toHaveBeenCalledWith('student@example.com', expect.any(String));
    expect(await screen.findByText('Code sent.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Activate account'}));

    expect(mocks.register).toHaveBeenCalledWith(
      {
        firstName: 'Student',
        lastName: 'One',
        tenantId: 1,
        email: 'student@example.com',
        password: 'Passw0rd1',
        verificationCode: '123456',
      },
      expect.any(String),
    );
    expect(mocks.setAccessToken).toHaveBeenCalledWith('registered-token');
    expect(mocks.storeLogin).toHaveBeenCalledWith(expect.objectContaining({id: 9}));
    expect(await screen.findByText('Student dashboard')).toBeInTheDocument();
  });

  it('blocks a password that the backend would reject', async () => {
    renderSignup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Institution ID'), '1');
    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.click(screen.getByRole('button', {name: 'Continue'}));
    await user.type(screen.getByLabelText('First name'), 'Student');
    await user.type(screen.getByLabelText('Last name'), 'One');
    await user.type(screen.getByLabelText('Password'), 'passwordonly');

    await user.click(screen.getByRole('button', {name: 'Continue'}));

    expect(await screen.findByText('Password format is invalid.')).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it('shows an invalid-code response beside the verification field', async () => {
    mocks.register.mockRejectedValue({
      code: 400,
      details: {code: 'INVALID_VERIFICATION_CODE'},
    });
    renderSignup();
    const user = await fillRegistration();

    await user.click(screen.getByRole('button', {name: 'Activate account'}));

    expect(await screen.findByText('Code is incorrect.')).toBeInTheDocument();
  });
  it('keeps a confirmation mismatch in the password step without registering', async () => {
    renderSignup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Institution ID'), '1');
    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.click(screen.getByRole('button', {name: 'Continue'}));
    await user.type(screen.getByLabelText('First name'), 'Student');
    await user.type(screen.getByLabelText('Last name'), 'One');
    await user.type(screen.getByLabelText('Password'), 'Passw0rd1');
    await user.type(screen.getByLabelText('Confirm password'), 'Different2');
    await user.click(screen.getByRole('button', {name: 'Continue'}));
    expect(screen.getByText('Passwords must match.')).toBeVisible();
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

});
