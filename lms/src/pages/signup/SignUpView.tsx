import {FormEvent, useEffect, useState} from 'react';
import {Eye, EyeOff} from 'lucide-react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';

import {AUTH_ERROR_CODES, V2ApiClient} from '@/apis';
import {authApiService} from '@/apis/services/auth-api';
import {useAuth} from '@/contexts/AuthContext';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorCode, isTransportOrServerFailure} from '@/utils/apiError';
import {isValidPassword} from '@/utils/passwordRules';
import styles from './SignUpView.module.scss';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_PATTERN = /^\d{6}$/;

type SignupField = 'firstName' | 'middleName' | 'lastName' | 'tenantId' | 'email' | 'password' | 'verificationCode';
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

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tenantId, setTenantId] = useState('');
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
    if (!firstName.trim()) errors.firstName = t('signupErrors.firstNameRequired');
    if (!lastName.trim()) errors.lastName = t('signupErrors.lastNameRequired');
    if (!Number.isInteger(Number(tenantId)) || Number(tenantId) < 1) {
      errors.tenantId = t('signupErrors.tenantIdRequired');
    }
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
      firstName: firstName.trim(),
      ...(middleName.trim() ? {middleName: middleName.trim()} : {}),
      lastName: lastName.trim(),
      tenantId: Number(tenantId),
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
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.visualPanel} aria-hidden="true">
          <img src="/icons/login/login-img-xlearn.png" alt=""/>
        </div>

        <section className={styles.formPanel}>
          <div className={styles.brandMark} aria-label="X-Learn">
            <img src="/icons/coursistant_icon_ver2.png" alt=""/>
            <span>X—LEARN</span>
          </div>
          <h1>{t('signup.title')}</h1>
          <p className={styles.subtitle}>{t('signup.subtitle')}</p>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="signup-first-name">{t('signup.firstNameLabel')}</label>
                <input
                  id="signup-first-name"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={event => {
                    setFirstName(event.target.value);
                    clearFieldError('firstName');
                  }}
                  placeholder={t('signup.firstNamePlaceholder')}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  aria-describedby={fieldErrors.firstName ? 'signup-first-name-error' : undefined}
                  className={fieldErrors.firstName ? styles.inputError : undefined}
                />
                {fieldErrors.firstName ? <p id="signup-first-name-error" className={styles.fieldError}>{fieldErrors.firstName}</p> : null}
              </div>
              <div className={styles.field}>
                <label htmlFor="signup-last-name">{t('signup.lastNameLabel')}</label>
                <input id="signup-last-name" type="text" autoComplete="family-name" value={lastName} onChange={event => { setLastName(event.target.value); clearFieldError('lastName'); }} placeholder={t('signup.lastNamePlaceholder')} aria-invalid={Boolean(fieldErrors.lastName)} aria-describedby={fieldErrors.lastName ? 'signup-last-name-error' : undefined} className={fieldErrors.lastName ? styles.inputError : undefined}/>
                {fieldErrors.lastName ? <p id="signup-last-name-error" className={styles.fieldError}>{fieldErrors.lastName}</p> : null}
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="signup-middle-name">{t('signup.middleNameLabel')}</label>
                <input id="signup-middle-name" type="text" autoComplete="additional-name" value={middleName} onChange={event => setMiddleName(event.target.value)} placeholder={t('signup.middleNamePlaceholder')}/>
              </div>
              <div className={styles.field}>
                <label htmlFor="signup-tenant-id">{t('signup.tenantIdLabel')}</label>
                <input id="signup-tenant-id" type="number" inputMode="numeric" min="1" value={tenantId} onChange={event => { setTenantId(event.target.value); clearFieldError('tenantId'); }} placeholder={t('signup.tenantIdPlaceholder')} aria-invalid={Boolean(fieldErrors.tenantId)} aria-describedby={fieldErrors.tenantId ? 'signup-tenant-id-error' : undefined} className={fieldErrors.tenantId ? styles.inputError : undefined}/>
                {fieldErrors.tenantId ? <p id="signup-tenant-id-error" className={styles.fieldError}>{fieldErrors.tenantId}</p> : null}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="signup-email">{t('signup.emailLabel')}</label>
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
                className={fieldErrors.email ? styles.inputError : undefined}
              />
              {fieldErrors.email ? <p id="signup-email-error" className={styles.fieldError}>{fieldErrors.email}</p> : null}
            </div>

            <div className={styles.field}>
              <label htmlFor="signup-password">{t('signup.passwordLabel')}</label>
              <div className={styles.passwordField}>
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
                  className={fieldErrors.password ? styles.inputError : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(previous => !previous)}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  className={styles.visibilityButton}
                >
                  {showPassword ? <Eye size={20} aria-hidden="true"/> : <EyeOff size={20} aria-hidden="true"/>}
                </button>
              </div>
              <p id="signup-password-help" className={fieldErrors.password ? styles.fieldError : styles.helpText}>
                {fieldErrors.password || t('signup.passwordHint')}
              </p>
            </div>

            <div className={styles.field}>
              <label htmlFor="signup-verification">{t('signup.verificationLabel')}</label>
              <div className={styles.verificationField}>
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
                  className={fieldErrors.verificationCode ? styles.inputError : undefined}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isSendingCode || countdown > 0}
                  className={styles.codeButton}
                >
                  {codeButtonLabel}
                </button>
              </div>
              {fieldErrors.verificationCode ? <p id="signup-verification-error" className={styles.fieldError}>{fieldErrors.verificationCode}</p> : null}
            </div>

            <div className={styles.messageArea} aria-live="polite">
              {notice ? <p className={styles.notice}>{notice}</p> : null}
              {formError ? <p role="alert" className={styles.formError}>{formError}</p> : null}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isSendingCode}
              className={styles.submitButton}
            >
              {isSubmitting ? t('signup.creatingAccount') : t('signup.continueButton')}
            </button>
          </form>

          <p className={styles.signinPrompt}>
            {t('signup.alreadyRegistered')}{' '}
            <Link to="/login">
              {t('signup.signinLink')}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
