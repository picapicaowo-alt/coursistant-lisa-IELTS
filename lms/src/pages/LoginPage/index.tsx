import React, {useEffect, useState} from 'react';
import {Eye, EyeOff} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {LoginAccountType, V2ApiClient} from '@/apis';
import {useAuth} from '@/contexts/AuthContext';
import {authApiService} from '@/apis/services/auth-api';
import {getSignedInHomePath} from '@/utils/signedInHomePath';
import {getLoginErrorKind} from './loginErrors';
import styles from './index.module.scss';

type ResolvableLoginRole = Extract<LoginAccountType, 'USER' | 'ADMIN'>;

const LOGIN_ROLE_STORAGE_KEY = 'preferredLoginRole';
const LOGIN_ROLES: ResolvableLoginRole[] = ['USER', 'ADMIN'];

const getLoginRoleOrder = (): ResolvableLoginRole[] => {
  const preferredRole = localStorage.getItem(LOGIN_ROLE_STORAGE_KEY) as ResolvableLoginRole | null;
  if (!preferredRole || !LOGIN_ROLES.includes(preferredRole)) return LOGIN_ROLES;
  return [preferredRole, ...LOGIN_ROLES.filter(role => role !== preferredRole)];
};

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const getFieldError = (field: string) => fieldErrors[field] || '';
  const {login, user} = useAuth();
  const navigate = useNavigate();
  const {t} = useTranslation('auth');

  useEffect(() => {
    const handleMessage = (event: MessageEvent<{redirectUrl?: string}>) => {
      if (event.data?.redirectUrl) navigate(event.data.redirectUrl);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  useEffect(() => {
    if (user) navigate(getSignedInHomePath(user), {replace: true});
  }, [navigate, user]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim();
      let response;
      let resolvedRole: ResolvableLoginRole | null = null;
      let lastError: unknown;

      // The backend still requires an account table even though account type
      // is not a user-facing login choice. Only retry after an explicit
      // INVALID_CREDENTIALS response so infrastructure errors stay visible.
      for (const role of getLoginRoleOrder()) {
        try {
          response = await authApiService.login({email: normalizedEmail, password, role});
          resolvedRole = role;
          break;
        } catch (error) {
          lastError = error;
          if (getLoginErrorKind(error) !== 'credentials') throw error;
        }
      }

      if (!response || !resolvedRole) throw lastError;

      if (response.status === 200 && response.data) {
        const auth = response.data;
        if (auth.mustChangePassword) {
          setFieldErrors({password: t('errors.passwordChangeRequired')});
          return;
        }

        login({...auth, id: auth.userId});
        V2ApiClient.setAccessToken(auth.accessToken);
        localStorage.setItem(LOGIN_ROLE_STORAGE_KEY, resolvedRole);
        localStorage.setItem('accToken', auth.accessToken);
        navigate(getSignedInHomePath({role: auth.role, level: auth.level}));
        return;
      }

      setFieldErrors({password: t('errors.unexpected')});
    } catch (error) {
      const errorKind = getLoginErrorKind(error);
      if (errorKind === 'credentials') {
        setFieldErrors({password: t('errors.invalidCredentials')});
      } else if (errorKind === 'unavailable') {
        setFieldErrors({password: t('errors.serviceUnavailable')});
      } else {
        console.error('Login failed', error);
        setFieldErrors({password: t('errors.unexpected')});
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailError = getFieldError('email');
  const passwordError = getFieldError('password');

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
          <h1>{t('login.title')}</h1>
          <p className={styles.subtitle}>{t('login.subtitle')}</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="login-email">{t('login.emailLabel')}</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder={t('login.emailPlaceholder')}
                className={emailError ? styles.inputError : undefined}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? 'login-email-error' : undefined}
                required
              />
              {emailError ? <p id="login-email-error" role="alert" className={styles.fieldError}>{emailError}</p> : null}
            </div>

            <div className={styles.field}>
              <label htmlFor="login-password">{t('login.passwordLabel')}</label>
              <div className={styles.passwordField}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  className={passwordError ? styles.inputError : undefined}
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? 'login-password-error' : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(current => !current)}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  className={styles.visibilityButton}
                >
                  {showPassword ? <Eye size={20} aria-hidden="true"/> : <EyeOff size={20} aria-hidden="true"/>}
                </button>
              </div>
              {passwordError ? <p id="login-password-error" role="alert" className={styles.fieldError}>{passwordError}</p> : null}
            </div>

            <div className={styles.forgotRow}>
              <a href="/forgotpassword">{t('login.forgotPassword')}</a>
            </div>

            <button type="submit" disabled={isSubmitting} className={styles.submitButton}>
              {isSubmitting ? t('login.loggingIn', {defaultValue: 'Logging in…'}) : t('login.logIn')}
            </button>
          </form>

          <p className={styles.signupPrompt}>
            {t('login.noAccount')}
            <a
              href="/signup"
              onClick={event => {
                event.preventDefault();
                navigate('/signup');
              }}
            >
              {t('login.signUp')}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
