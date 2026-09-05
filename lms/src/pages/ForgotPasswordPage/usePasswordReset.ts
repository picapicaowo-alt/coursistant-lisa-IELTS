import {FormEvent, useEffect, useRef, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {authApiService} from '@/apis/services/auth-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorMessage} from '@/utils/apiError';
import {isValidPassword} from '@/utils/passwordRules';
import {LocalizedError} from '@/i18n/errors';

export type PasswordResetStep = 'email' | 'code' | 'password' | 'complete';

interface PasswordResetLocationState {
  forced?: boolean;
  email?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;

/**
 * Coordinates both self-service and forced password-reset entry paths.
 * A forced reset may begin at the code step with router-provided identity, but
 * the same final request verifies the code and changes the password atomically.
 */
const usePasswordReset = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {t} = useTranslation('auth');
  const idempotency = useIdempotencyCheckpoint();
  const query = new URLSearchParams(location.search);
  const locationState = (location.state ?? {}) as PasswordResetLocationState;
  const forced = locationState.forced === true || query.get('forced') === '1';
  const presetEmail = locationState.email || query.get('email') || '';

  const [step, setStep] = useState<PasswordResetStep>(forced && presetEmail ? 'code' : 'email');
  const [email, setEmail] = useState(presetEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [failure, setError] = useState<unknown>('');
  const [failureKey, setFailureKey] = useState('forgotPasswordErrors.updateError');
  const error = failure ? getApiErrorMessage(failure, t(failureKey)) : '';
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (forced && presetEmail) {
      setEmail(presetEmail);
      setStep('code');
    }
  }, [forced, presetEmail]);

  const sendCode = async () => {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError(new LocalizedError('auth:forgotPasswordErrors.emailRequired'));
      return;
    }
    setSubmitting(true);
    setError('');
    const operation = 'auth-password-reset-verification';
    const idempotencyKey = idempotency.keyFor(operation, normalized);
    try {
      await authApiService.sendPasswordResetVerification(normalized, idempotencyKey);
      idempotency.complete(operation, idempotencyKey);
      setEmail(normalized);
      setCode('');
      setStep('code');
    } catch (cause) {
      setFailureKey('forgotPasswordErrors.sendVerificationFailed');
      setError(cause);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCode = (event: FormEvent) => {
    event.preventDefault();
    // This step validates shape only. The code is intentionally not consumed
    // until resetPassword verifies it together with the new password.
    if (code.trim().length !== CODE_LENGTH) {
      setError(new LocalizedError('auth:forgotPasswordErrors.codeRequired'));
      return;
    }
    setError('');
    setStep('password');
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValidPassword(password)) {
      setError(new LocalizedError('auth:forgotPasswordErrors.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(new LocalizedError('auth:forgotPasswordErrors.passwordsDontMatch'));
      return;
    }
    setSubmitting(true);
    setError('');
    const request = {
      email,
      verificationCode: code,
      newPassword: password,
    };
    const operation = 'auth-password-reset';
    const idempotencyKey = idempotency.keyFor(operation, idempotencyFingerprint(request));
    try {
      await authApiService.resetPassword(request, idempotencyKey);
      idempotency.complete(operation, idempotencyKey);
      setStep('complete');
    } catch (cause) {
      setFailureKey('forgotPasswordErrors.updateError');
      setError(cause);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    t,
    navigate,
    step,
    setStep,
    forced,
    email,
    setEmail,
    code,
    setCode,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    isSubmitting,
    error,
    setError,
    inputRefs,
    sendCode,
    confirmCode,
    submitPassword,
  };
};

export default usePasswordReset;
