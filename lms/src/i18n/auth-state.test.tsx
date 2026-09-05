import {act, fireEvent, render, renderHook, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import i18n, {SUPPORTED_LOCALES} from './index';
import usePasswordReset from '@/pages/ForgotPasswordPage/usePasswordReset';
import SignUpView from '@/pages/signup/SignUpView';

const api = vi.hoisted(() => ({sendPasswordResetVerification: vi.fn(), resetPassword: vi.fn(), sendRegistrationVerification: vi.fn(), register: vi.fn()}));
vi.mock('@/apis/services/auth-api', () => ({authApiService: api}));
vi.mock('@/contexts/AuthContext', () => ({useAuth: () => ({login: vi.fn()})}));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

it('updates password-reset validation and request errors while preserving drafts and retry identity', async () => {
  const {result} = renderHook(usePasswordReset, {wrapper: ({children}) => <MemoryRouter>{children}</MemoryRouter>});
  await act(() => result.current.sendCode());
  for (const locale of SUPPORTED_LOCALES) {
    await act(() => i18n.changeLanguage(locale));
    expect(result.current.error).toBe(i18n.t('auth:forgotPasswordErrors.emailRequired'));
  }
  act(() => {
    result.current.setEmail('Student@Example.test');
    result.current.setCode('123456');
    result.current.setPassword('UnsubmittedDraft1');
  });
  api.sendPasswordResetVerification.mockRejectedValue(new Error('Unlocalized service diagnostic'));
  await act(() => result.current.sendCode());
  const firstKey = api.sendPasswordResetVerification.mock.calls[0][1];
  for (const locale of SUPPORTED_LOCALES) {
    await act(() => i18n.changeLanguage(locale));
    expect(result.current.error).toBe(i18n.t('auth:forgotPasswordErrors.sendVerificationFailed'));
    expect(result.current.email).toBe('Student@Example.test');
    expect(result.current.code).toBe('123456');
    expect(result.current.password).toBe('UnsubmittedDraft1');
    expect(result.current.step).toBe('email');
  }
  await act(() => result.current.sendCode());
  expect(api.sendPasswordResetVerification).toHaveBeenLastCalledWith('student@example.test', firstKey);
  expect(api.resetPassword).not.toHaveBeenCalled();
});

it('updates signup field errors and sent-code feedback without losing the registration draft', async () => {
  api.sendRegistrationVerification.mockResolvedValue({status: 200, data: null});
  render(<MemoryRouter><SignUpView/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(i18n.t('auth:signup.emailLabel')), {target: {value: 'learner@example.test'}});
  fireEvent.click(screen.getByRole('button', {name: i18n.t('auth:signup.continueButton')}));
  for (const locale of SUPPORTED_LOCALES) {
    await act(() => i18n.changeLanguage(locale));
    expect(screen.getByText(i18n.t('auth:signupErrors.tenantIdRequired'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('auth:signup.emailLabel'))).toHaveValue('learner@example.test');
  }
  fireEvent.change(screen.getByLabelText(i18n.t('auth:signup.tenantIdLabel')), {target: {value: '1'}});
  fireEvent.click(screen.getByRole('button', {name: i18n.t('auth:signup.continueButton')}));
  for (const [key, value] of [['firstNameLabel', 'Original'], ['lastNameLabel', 'Learner'], ['passwordLabel', 'UnsubmittedDraft1'], ['confirmPasswordLabel', 'UnsubmittedDraft1']]) {
    fireEvent.change(screen.getByLabelText(i18n.t(`auth:signup.${key}`)), {target: {value}});
  }
  fireEvent.click(screen.getByRole('button', {name: i18n.t('auth:signup.continueButton')}));
  fireEvent.change(screen.getByLabelText(i18n.t('auth:signup.verificationLabel')), {target: {value: '123456'}});
  await act(async () => fireEvent.click(screen.getByRole('button', {name: i18n.t('auth:signup.verifyEmail')})));
  for (const locale of SUPPORTED_LOCALES) {
    await act(() => i18n.changeLanguage(locale));
    expect(screen.getByText(i18n.t('auth:signupErrors.verificationCodeSent'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('auth:signup.verificationLabel'))).toHaveValue('123456');
  }
  expect(api.sendRegistrationVerification).toHaveBeenCalledExactlyOnceWith('learner@example.test', expect.any(String));
  expect(api.register).not.toHaveBeenCalled();
});
