import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@testing-library/jest-dom';
import i18n from '@/i18n';
import type {TOptions} from 'i18next';

const authApi = vi.hoisted(() => ({
  sendPasswordResetVerification: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('@/apis/services/auth-api', () => ({authApiService: authApi}));
vi.mock('../ProgressBar.jsx', () => ({default: () => <div>progress</div>}));
vi.mock('@iconify/react', () => ({Icon: () => <span/>}));

const copy: Record<string, string> = {
  'forgotPassword.title': 'Forgot Password?',
  'forgotPassword.subtitle': 'Reset instructions',
  'forgotPassword.emailPlaceholder': 'Enter email address',
  'forgotPassword.resetButton': 'Reset password',
  'forgotPassword.loading': 'Loading...',
  'forgotPassword.backToLogin': 'Back to',
  'forgotPassword.newUser': 'New to Coursistant?',
  'forgotPassword.createAccountLink': 'Create account',
  'forgotPassword.otpTitle': 'Password Reset',
  'forgotPassword.otpSubtitlePrefix': 'We sent a code to',
  'forgotPassword.verifyButton': 'Verify Email',
  'forgotPassword.noEmailText': "Didn't receive the email?",
  'forgotPassword.resendLink': 'Click to resend',
  'forgotPassword.newPasswordTitle': 'Set new password',
  'forgotPassword.newPasswordSubtitle': 'Use at least 8 characters with both a letter and a number.',
  'forgotPassword.newPasswordPlaceholder': 'Enter new password',
  'forgotPassword.confirmPasswordPlaceholder': 'Confirm Password',
  'forgotPassword.resetPasswordButton': 'Reset Password',
  'forgotPassword.successTitle': 'Successful password reset!',
  'forgotPassword.successSubtitle': 'You can now log in.',
  'forgotPassword.loginButton': 'Log in',
  'forgotPasswordErrors.emailRequired': 'Please enter email',
  'forgotPasswordErrors.codeRequired': 'Please enter the code',
  'forgotPasswordErrors.passwordTooShort': 'Use at least 8 characters with both letters and numbers.',
  'forgotPasswordErrors.passwordsDontMatch': 'Passwords do not match!',
  'forgotPasswordErrors.sendVerificationFailed': 'Failed to send verification code.',
  'forgotPasswordErrors.updateError': 'Could not update password.',
  'login.emailLabel': 'Email',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
};

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: (namespace = 'auth') => ({
    i18n,
    t: (key: string, options?: TOptions) => (namespace === 'auth' ? copy[key.replace(/^auth:/, '')] : undefined) ?? i18n.t(key, {...options, ns: namespace}),
  }),
}));

import ForgotPasswordPage from './index';

const renderPage = () => render(
  <MemoryRouter initialEntries={['/forgotpassword']}>
    <Routes>
      <Route path="/forgotpassword" element={<ForgotPasswordPage/>}/>
      <Route path="/login" element={<div>Login screen</div>}/>
    </Routes>
  </MemoryRouter>
);

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.sendPasswordResetVerification.mockResolvedValue({status: 200, data: null});
    authApi.resetPassword.mockResolvedValue({status: 200, data: null});
  });

  it('walks email → code → password → complete with the shared password rule', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText('Enter email address'), 'student@example.com');
    await user.click(screen.getByRole('button', {name: 'Reset password'}));
    await waitFor(() => {
      expect(authApi.sendPasswordResetVerification).toHaveBeenCalledWith('student@example.com', expect.any(String));
    });

    for (const [index, digit] of ['1', '2', '3', '4', '5', '6'].entries()) {
      await user.type(screen.getByLabelText(`Digit ${index + 1}`), digit);
    }
    await user.click(screen.getByRole('button', {name: 'Verify Email'}));

    await user.type(screen.getByPlaceholderText('Enter new password'), 'passwordonly');
    await user.type(screen.getByPlaceholderText('Confirm Password'), 'passwordonly');
    await user.click(screen.getByRole('button', {name: 'Reset Password'}));
    expect(await screen.findByText('Use at least 8 characters with both letters and numbers.')).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();

    await user.clear(screen.getByPlaceholderText('Enter new password'));
    await user.clear(screen.getByPlaceholderText('Confirm Password'));
    await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPassw0rd');
    await user.type(screen.getByPlaceholderText('Confirm Password'), 'NewPassw0rd');
    await user.click(screen.getByRole('button', {name: 'Reset Password'}));

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledWith(
        {
          email: 'student@example.com',
          verificationCode: '123456',
          newPassword: 'NewPassw0rd',
        },
        expect.any(String),
      );
    });
    expect(await screen.findByRole('heading', {name: 'Successful password reset!'})).toBeInTheDocument();
  });
});
