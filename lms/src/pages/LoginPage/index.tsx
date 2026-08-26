import React, {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Icon} from '@iconify/react';
import {useAuth} from "@/contexts/AuthContext";
import {useTranslation} from 'react-i18next';
import {LoginAccountType, V2ApiClient} from "@/apis";
import {authApiService} from "@/apis/services/auth-api";
import {getLoginErrorKind} from './loginErrors';
import {getSignedInHomePath} from '@/utils/signedInHomePath';

type ResolvableLoginRole = Extract<LoginAccountType, 'USER' | 'ADMIN'>;

const LOGIN_ROLE_STORAGE_KEY = 'preferredLoginRole';
const LOGIN_ROLES: ResolvableLoginRole[] = ['USER', 'ADMIN'];

const getLoginRoleOrder = (): ResolvableLoginRole[] => {
  const preferredRole = localStorage.getItem(LOGIN_ROLE_STORAGE_KEY) as ResolvableLoginRole | null;
  if (!preferredRole || !LOGIN_ROLES.includes(preferredRole)) return LOGIN_ROLES;
  return [preferredRole, ...LOGIN_ROLES.filter((role) => role !== preferredRole)];
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
  const {t} = useTranslation("auth");
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent<{redirectUrl?: string}>) => {
      if (event.data && event.data.redirectUrl) {
        navigate(event.data.redirectUrl);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [navigate]);
  
  useEffect(() => {
    if (user) {
      navigate(getSignedInHomePath(user), {replace: true});
    }
  }, [navigate, user]);
  
  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    setIsSubmitting(true);
    
    try {
      const normalizedEmail = email.trim();
      let response;
      let resolvedRole: ResolvableLoginRole | null = null;
      let lastError: unknown;

      // The current backend contract still requires an account table even
      // though account type is not a user-facing login decision. Try the most
      // recently successful table first, then the other supported table, and
      // only fall back after an explicit INVALID_CREDENTIALS response.
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

        // Managed users (every instructor, since ops creates those accounts)
        // land here on first login, and the backend then 403s every business
        // API until the password changes. There is no screen for this yet —
        // open-decisions.md Q-16 — so refuse the session rather than drop the
        // user into an app where nothing works.
        if (auth.mustChangePassword) {
          setFieldErrors({password: t("errors.passwordChangeRequired")});
          return;
        }

        login({...auth, id: auth.userId});
        V2ApiClient.setAccessToken(auth.accessToken);
        localStorage.setItem(LOGIN_ROLE_STORAGE_KEY, resolvedRole);
        localStorage.setItem('accToken', auth.accessToken);
        navigate(getSignedInHomePath({role: auth.role, level: auth.level}));
        return;
      }

      setFieldErrors({password: t("errors.unexpected")});
    } catch (err) {
      // The API answers wrong password, unknown account and locked-out all as
      // INVALID_CREDENTIALS on purpose (NFR-15). Do not try to tell the user
      // which one it was — the frontend cannot know, and guessing would leak
      // whether an account exists.
      const errorKind = getLoginErrorKind(err);

      if (errorKind === 'credentials') {
        setFieldErrors({password: t("errors.invalidCredentials")});
      } else if (errorKind === 'unavailable') {
        setFieldErrors({password: t("errors.serviceUnavailable")});
      } else {
        console.error('Login failed', err);
        setFieldErrors({password: t("errors.unexpected")});
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  
  return (
    <main className="min-h-screen overflow-y-auto bg-white px-4 py-6 text-gray-900 sm:px-8 lg:flex lg:items-center">
      <div className="mx-auto grid w-full max-w-[1500px] grid-cols-1 items-stretch gap-8 lg:grid-cols-[55%_45%] lg:gap-10">
        {/* Left side image */}
        <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
          <img src="/icons/login/login-img-xlearn.png" alt=""
               className="max-h-[calc(100vh-48px)] w-full rounded-2xl object-cover"/>
        </div>
        
        {/* Right side form */}
        <section className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-[512px] flex-col justify-center py-6">
          <h2 className="text-3xl sm:text-4xl mb-6 text-gray-800">
            {t("login.title")}
          </h2>
          <p className="text-sm text-[#718096] mb-12">
            {t("login.subtitle")}
          </p>
          
          <form className="space-y-4 mt-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-[#2D3748] mb-2">
                {t("login.emailLabel")}
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("login.emailPlaceholder")}
                className={`w-full px-4 py-3 rounded-lg bg-white border text-gray-900 text-sm focus:outline-none ${getFieldError('email') ? 'border-red-500' : 'border-gray-300 focus:border-[#566FE8]'
                }`}
                required
              />
              {getFieldError('email') && (
                <p role="alert" className="text-red-400 text-[12px] text-right mt-1">{getFieldError('email')}</p>
              )}
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-[#2D3748] mb-2">
                {t("login.passwordLabel")}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  className={`w-full px-4 py-3 rounded-lg bg-white border text-gray-900 text-sm focus:outline-none ${getFieldError('password') ? 'border-red-500' : 'border-gray-300 focus:border-[#566FE8]'}`}
                  required
                />

                <div className="absolute inset-y-0 right-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                    className="text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    <Icon icon={showPassword ? 'eva:eye-fill' : 'eva:eye-off-fill'} width={20} height={20}/>
                  </button>
                </div>
              </div>
              {getFieldError('password') && (
                <p role="alert" className="text-red-400 text-[12px] text-right mt-1">{getFieldError('password')}</p>
              )}
            </div>
            
            <div className="flex justify-end text-sm">
              <a href="/forgotpassword" className=" text-[14px] text-[#566FE8] text-sm hover:underline">
                {t("login.forgotPassword")}
              </a>
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg bg-[#566FE8] hover:bg-[#7F9CF5] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm mt-8 cursor-pointer"
            >
              {t("login.logIn")}
            </button>
          </form>
          
          <p className="text-sm text-center mt-6">
            {t("login.noAccount")}
            <a href="/signup" className="text-[#566FE8] text-sm ml-1"
               onClick={(event) => {
                 event.preventDefault();
                 navigate('/signup');
               }}>{t("login.signUp")}</a>
          </p>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
