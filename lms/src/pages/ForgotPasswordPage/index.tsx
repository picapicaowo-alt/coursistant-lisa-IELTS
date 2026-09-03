import {ChangeEvent, KeyboardEvent} from 'react';
import {Icon} from '@iconify/react';
import {Link} from 'react-router-dom';
import {AuthShell} from '@/components/AuthShell';
import usePasswordReset from './usePasswordReset';
import styles from './index.module.scss';

const ForgotPasswordPage = () => {
  const reset = usePasswordReset();
  const {
    t, navigate, step, setStep, forced, email, setEmail, code, setCode, password, setPassword,
    confirmPassword, setConfirmPassword, showPassword, setShowPassword, isSubmitting, error, setError,
    inputRefs, sendCode, confirmCode, submitPassword,
  } = reset;

  const codeDigits = Array.from({length: 6}, (_, index) => code[index] ?? '');

  const updateDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = codeDigits.map((current, currentIndex) => currentIndex === index ? digit : current);
    setCode(next.join(''));
    setError('');
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const pasted = event.target.value.replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 1) {
      setCode(pasted.padEnd(6, '').slice(0, 6));
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    } else {
      updateDigit(index, pasted);
    }
  };

  return (
    <AuthShell>
      <ol className={styles.steps} aria-label="Password reset progress">{(['email', 'code', 'password', 'complete'] as const).map((item, index) => <li key={item} aria-current={step === item ? 'step' : undefined}><span>{index + 1}</span>{['Email', 'Verification', 'New password', 'Complete'][index]}</li>)}</ol>
            {step === 'email' ? (
              <>
                <Link to="/login" className={styles.backLink}>{t('forgotPassword.backToLogin')}</Link>
                <h1 className={styles.title}>{t('forgotPassword.title')}</h1>
                <p className={styles.subtitle}>{t('forgotPassword.subtitle')}</p>
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    void sendCode();
                  }}
                >
                  <label className={styles.field} htmlFor="reset-email">
                    <span className={styles.srOnly}>{t('login.emailLabel')}</span>
                    <input
                      id="reset-email"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'reset-error' : undefined}
                      type="email"
                      value={email}
                      onChange={event => {
                        setEmail(event.target.value);
                        setError('');
                      }}
                      placeholder={t('forgotPassword.emailPlaceholder')}
                      required
                      autoComplete="email"
                    />
                  </label>
                  {error ? <p id="reset-error" className={styles.error} role="alert">{error}</p> : null}
                  <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                    {isSubmitting ? t('forgotPassword.loading') : t('forgotPassword.resetButton')}
                  </button>
                </form>
                <p className={styles.footerNote}>
                  {t('forgotPassword.newUser')}
                  <Link to="/signup" className={styles.inlineLink}>{t('forgotPassword.createAccountLink')}</Link>
                </p>
              </>
            ) : null}

            {step === 'code' ? (
              <form onSubmit={confirmCode}>
                {!forced ? (
                  <button type="button" className={styles.backLink} onClick={() => setStep('email')}>
                    {t('forgotPassword.backToLogin')}
                  </button>
                ) : null}
                <h1 className={styles.title}>{t('forgotPassword.otpTitle')}</h1>
                <p className={styles.subtitle}>
                  {t('forgotPassword.otpSubtitlePrefix')} <strong>{email}</strong>
                </p>
                <div className={styles.codeRow} role="group" aria-label={t('forgotPassword.otpTitle')}>
                  {codeDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={element => {
                        inputRefs.current[index] = element;
                      }}
                      className={styles.codeInput}
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      aria-label={`Digit ${index + 1}`}
                      onChange={event => handleCodePaste(event, index)}
                      onKeyDown={event => handleCodeKeyDown(event, index)}
                    />
                  ))}
                </div>
                {error ? <p id="reset-error" className={styles.error} role="alert">{error}</p> : null}
                <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                  {t('forgotPassword.verifyButton')}
                </button>
                <p className={styles.footerNote}>
                  {t('forgotPassword.noEmailText')}
                  <button type="button" className={styles.inlineButton} onClick={() => void sendCode()} disabled={isSubmitting}>
                    {t('forgotPassword.resendLink')}
                  </button>
                </p>
              </form>
            ) : null}

            {step === 'password' ? (
              <form onSubmit={event => void submitPassword(event)}>
                <button type="button" className={styles.backLink} onClick={() => setStep('code')}>
                  {t('forgotPassword.backToLogin')}
                </button>
                <h1 className={styles.title}>{t('forgotPassword.newPasswordTitle')}</h1>
                <p className={styles.subtitle}>{t('forgotPassword.newPasswordSubtitle')}</p>
                <label className={styles.field} htmlFor="reset-password">
                  <span className={styles.srOnly}>{t('forgotPassword.newPasswordPlaceholder')}</span>
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder={t('forgotPassword.newPasswordPlaceholder')}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className={styles.visibility}
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    onClick={() => setShowPassword(value => !value)}
                  >
                    <Icon icon={showPassword ? 'mdi:eye-off-outline' : 'mdi:eye-outline'} width={20}/>
                  </button>
                </label>
                <label className={styles.field} htmlFor="reset-password-confirm">
                  <span className={styles.srOnly}>{t('forgotPassword.confirmPasswordPlaceholder')}</span>
                  <input
                    id="reset-password-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    placeholder={t('forgotPassword.confirmPasswordPlaceholder')}
                    autoComplete="new-password"
                    required
                  />
                </label>
                {error ? <p id="reset-error" className={styles.error} role="alert">{error}</p> : null}
                <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                  {isSubmitting ? t('forgotPassword.loading') : t('forgotPassword.resetPasswordButton')}
                </button>
              </form>
            ) : null}

            {step === 'complete' ? (
              <div>
                <h1 className={styles.title}>{t('forgotPassword.successTitle')}</h1>
                <p className={styles.subtitle}>{t('forgotPassword.successSubtitle')}</p>
                <button type="button" className={styles.primaryButton} onClick={() => navigate('/login', {replace: true})}>
                  {t('forgotPassword.loginButton')}
                </button>
              </div>
            ) : null}
    </AuthShell>
  );
};

export default ForgotPasswordPage;
