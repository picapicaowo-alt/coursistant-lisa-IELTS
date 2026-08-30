import {FormEvent, useEffect, useState} from 'react';
import {Icon} from '@iconify/react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';

import {AUTH_ERROR_CODES, V2ApiClient} from '@/apis';
import {authApiService} from '@/apis/services/auth-api';
import {useAuth} from '@/contexts/AuthContext';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorCode, isTransportOrServerFailure} from '@/utils/apiError';
import {isValidPassword} from '@/utils/passwordRules';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_PATTERN = /^\d{6}$/;

type SignupField = 'name' | 'email' | 'password' | 'verificationCode';
type SignupFieldErrors = Partial<Record<SignupField, string>>;

const formatCountdown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

export default function SignUpView() {
  const navigate = useNavigate();
  const {login} = useAuth();
  const {t} = useTranslation('auth');
  const idempotency = useIdempotencyCheckpoint();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setCountdown(previous => Math.max(0, previous - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const clearFieldError = (field: SignupField) => {
    setFieldErrors(previous => {
      if (!previous[field]) return previous;
      const next = {...previous};
      delete next[field];
      return next;
    });
    setFormError('');
  };

  const validate = (): SignupFieldErrors => {
    const errors: SignupFieldErrors = {};
    if (!name.trim()) errors.name = t('signupErrors.nicknameRequired');
    if (!email.trim()) errors.email = t('signupErrors.emailRequired');
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = t('signupErrors.emailInvalid');
    if (!password) errors.password = t('signupErrors.passwordRequired');
    else if (!isValidPassword(password)) errors.password = t('signupErrors.passwordFormat');
    if (!verificationCode.trim()) errors.verificationCode = t('signupErrors.verificationRequired');
    else if (!VERIFICATION_CODE_PATTERN.test(verificationCode.trim())) {
      errors.verificationCode = t('signupErrors.verificationCodeFormat');
    }
    return errors;
  };

  const handleSendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setNotice('');
    setFormError('');

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setFieldErrors(previous => ({...previous, email: t('signupErrors.emailInvalid')}));
      return;
    }

    setIsSendingCode(true);
    const operation = 'auth-registration-verification';
    const idempotencyKey = idempotency.keyFor(operation, normalizedEmail);
    try {
      await authApiService.sendRegistrationVerification(normalizedEmail, idempotencyKey);
      idempotency.complete(operation, idempotencyKey);
      setCountdown(60);
      setNotice(t('signupErrors.verificationCodeSent'));
    } catch (error) {
      const code = getApiErrorCode(error);
      if (code === AUTH_ERROR_CODES.verificationResendCooldown) {
        setFormError(t('signupErrors.resendCooldown'));
      } else if (code === AUTH_ERROR_CODES.verificationHourlyLimit) {
        setFormError(t('signupErrors.hourlyLimit'));
      } else {
        setFormError(t('signupErrors.sendVerificationFailed'));
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    setFormError('');
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    const request = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      verificationCode: verificationCode.trim(),
    };
    const operation = 'auth-register';
    const idempotencyKey = idempotency.keyFor(operation, idempotencyFingerprint(request));
    try {
      const response = await authApiService.register(request, idempotencyKey);

      if (response.status !== 200 || !response.data) {
        setFormError(t('signupErrors.signupFailed'));
        return;
      }

      const auth = response.data;
      idempotency.complete(operation, idempotencyKey);
      V2ApiClient.setAccessToken(auth.accessToken);
      localStorage.setItem('accToken', auth.accessToken);
      localStorage.setItem('preferredLoginRole', 'USER');
      login({...auth, id: auth.userId});
      navigate('/', {replace: true});
    } catch (error) {
      const code = getApiErrorCode(error);
      if (code === AUTH_ERROR_CODES.invalidPasswordFormat) {
        setFieldErrors({password: t('signupErrors.passwordFormat')});
      } else if (code === AUTH_ERROR_CODES.invalidVerificationCode) {
        setFieldErrors({verificationCode: t('signupErrors.verificationFailed')});
      } else if (code === AUTH_ERROR_CODES.verificationCodeExpired) {
        setFieldErrors({verificationCode: t('signupErrors.verificationExpired')});
      } else if (code === AUTH_ERROR_CODES.verificationAttemptsExceeded) {
        setFieldErrors({verificationCode: t('signupErrors.verificationAttemptsExceeded')});
      } else {
        const unavailable = isTransportOrServerFailure(error);
        setFormError(unavailable ? t('signupErrors.serviceUnavailable') : t('signupErrors.signupFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const codeButtonLabel = countdown > 0
    ? t('signup.verifyTime', {time: formatCountdown(countdown)})
    : isSendingCode
      ? t('signup.sendingCode')
      : t('signup.verifyEmail');

  return (
    <main className="min-h-screen overflow-y-auto bg-white px-4 py-6 text-gray-900 sm:px-8 lg:flex lg:items-center">
      <div className="mx-auto grid w-full max-w-[1500px] grid-cols-1 items-stretch gap-8 lg:grid-cols-[55%_45%] lg:gap-10">
        <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
          <img
            src="/icons/login/login-img.png"
            alt=""
            className="max-h-[calc(100vh-48px)] w-full rounded-2xl object-cover"
          />
        </div>

        <section className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-[512px] flex-col justify-center py-6">
          <h1 className="mb-4 text-[32px] font-semibold leading-tight text-[#2D3748] sm:text-4xl xl:text-5xl">
            {t('signup.title')}
          </h1>
          <p className="mb-10 text-sm text-[#718096]">{t('signup.subtitle')}</p>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label className="sr-only" htmlFor="signup-name">{t('signup.nameLabel')}</label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={event => {
                  setName(event.target.value);
                  clearFieldError('name');
                }}
                placeholder={t('signup.nicknamePlaceholder')}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'signup-name-error' : undefined}
                className={`h-[50px] w-full rounded-[15px] border bg-white px-[18px] text-sm outline-none transition focus:border-[#566FE8] focus:ring-2 focus:ring-[#566FE8]/15 ${fieldErrors.name ? 'border-red-500' : 'border-[#E2E8F0]'}`}
              />
              {fieldErrors.name ? <p id="signup-name-error" className="mt-1 text-right text-xs text-red-500">{fieldErrors.name}</p> : null}
            </div>

            <div>
              <label className="sr-only" htmlFor="signup-email">{t('signup.emailLabel')}</label>
              <input
                id="signup-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={event => {
                  setEmail(event.target.value);
                  setNotice('');
                  clearFieldError('email');
                }}
                placeholder={t('signup.emailPlaceholder')}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
                className={`h-[50px] w-full rounded-[15px] border bg-white px-[18px] text-sm outline-none transition focus:border-[#566FE8] focus:ring-2 focus:ring-[#566FE8]/15 ${fieldErrors.email ? 'border-red-500' : 'border-[#E2E8F0]'}`}
              />
              {fieldErrors.email ? <p id="signup-email-error" className="mt-1 text-right text-xs text-red-500">{fieldErrors.email}</p> : null}
            </div>

            <div>
              <label className="sr-only" htmlFor="signup-password">{t('signup.passwordLabel')}</label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={event => {
                    setPassword(event.target.value);
                    clearFieldError('password');
                  }}
                  placeholder={t('signup.passwordPlaceholder')}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby="signup-password-help"
                  className={`h-[50px] w-full rounded-[15px] border bg-white px-[18px] pr-12 text-sm outline-none transition focus:border-[#566FE8] focus:ring-2 focus:ring-[#566FE8]/15 ${fieldErrors.password ? 'border-red-500' : 'border-[#E2E8F0]'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(previous => !previous)}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded text-[#718096] hover:text-[#2D3748] focus-visible:outline-2 focus-visible:outline-[#566FE8]"
                >
                  <Icon icon={showPassword ? 'eva:eye-fill' : 'eva:eye-off-fill'} width={22} height={22}/>
                </button>
              </div>
              <p id="signup-password-help" className={`mt-1 text-xs ${fieldErrors.password ? 'text-right text-red-500' : 'text-[#718096]'}`}>
                {fieldErrors.password || t('signup.passwordHint')}
              </p>
            </div>

            <div>
              <label className="sr-only" htmlFor="signup-verification">{t('signup.verificationLabel')}</label>
              <div className="relative">
                <input
                  id="signup-verification"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={verificationCode}
                  onChange={event => {
                    setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    clearFieldError('verificationCode');
                  }}
                  placeholder={t('signup.verificationPlaceholder')}
                  aria-invalid={Boolean(fieldErrors.verificationCode)}
                  aria-describedby={fieldErrors.verificationCode ? 'signup-verification-error' : undefined}
                  className={`h-[50px] w-full rounded-[15px] border bg-white px-[18px] pr-36 text-sm outline-none transition focus:border-[#566FE8] focus:ring-2 focus:ring-[#566FE8]/15 ${fieldErrors.verificationCode ? 'border-red-500' : 'border-[#E2E8F0]'}`}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isSendingCode || countdown > 0}
                  className="absolute inset-y-0 right-3 my-auto h-fit rounded px-1 text-sm font-medium text-[#566FE8] hover:underline disabled:cursor-not-allowed disabled:text-[#A0AEC0] disabled:no-underline focus-visible:outline-2 focus-visible:outline-[#566FE8]"
                >
                  {codeButtonLabel}
                </button>
              </div>
              {fieldErrors.verificationCode ? <p id="signup-verification-error" className="mt-1 text-right text-xs text-red-500">{fieldErrors.verificationCode}</p> : null}
            </div>

            <div className="min-h-5" aria-live="polite">
              {notice ? <p className="text-sm text-green-600">{notice}</p> : null}
              {formError ? <p role="alert" className="text-sm text-red-500">{formError}</p> : null}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isSendingCode}
              className="h-[50px] w-full rounded-[15px] bg-[#566FE8] text-base font-semibold text-white transition hover:bg-[#465CCE] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#566FE8]"
            >
              {isSubmitting ? t('signup.creatingAccount') : t('signup.continueButton')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#A0AEC0]">
            {t('signup.alreadyRegistered')}{' '}
            <Link className="font-medium text-[#566FE8] underline-offset-2 hover:underline" to="/login">
              {t('signup.signinLink')}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
