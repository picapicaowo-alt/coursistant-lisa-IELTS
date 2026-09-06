import {useTranslation} from 'react-i18next';
import {roleLabel} from '@/i18n/presentation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {LANGUAGE_SWITCHER_ENABLED} from '@/i18n/configuration';
import {FormEvent, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, Eye, EyeOff} from 'lucide-react';
import styles from './styles.module.scss';
import type {UpdateProfileRequest} from '@/apis';
import {unwrapData} from '@/apis';
import {authApiService} from '@/apis/services/auth-api';
import {profileApiService} from '@/apis/services/profile-api';
import {useAuth} from '@/contexts/AuthContext';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorMessage} from '@/utils/apiError';
import {isValidPassword} from '@/utils/passwordRules';
import {formatPersonName} from '@/utils/personName';

const tabList = ['Account', 'Password', 'Notifications'] as const;
type SettingsTab = (typeof tabList)[number];

interface StatusMessage {
  kind: 'success' | 'error';
  key: string;
  error?: unknown;
}

const SettingsPage = () => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {user, updateProfile} = useAuth();
  const tenantAdmin = user?.role === 'TENANT_ADMIN';
  const [activeTab, setActiveTab] = useState<SettingsTab>(tenantAdmin ? 'Password' : 'Account');
  const [profileDraft, setProfileDraft] = useState<UpdateProfileRequest>({});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => unwrapData(await profileApiService.getMyProfile(), 'Load profile'),
    enabled: !tenantAdmin,
  });

  // Keep edits separate from server state: either tab can save without replacing
  // the other tab's draft, and a late response cannot overwrite newer input.
  const firstName = profileDraft.firstName ?? profileQuery.data?.firstName ?? '';
  const middleName = profileDraft.middleName ?? profileQuery.data?.middleName ?? '';
  const lastName = profileDraft.lastName ?? profileQuery.data?.lastName ?? '';
  const phone = profileDraft.phone ?? profileQuery.data?.phone ?? '';
  const emailNotifications = profileDraft.emailNotifications ?? profileQuery.data?.emailNotifications ?? false;
  const editProfileField = <Key extends keyof UpdateProfileRequest,>(key: Key, value: UpdateProfileRequest[Key]) => {
    setProfileDraft(current => ({...current, [key]: value}));
  };

  const saveProfile = useMutation({
    mutationFn: async (changes: UpdateProfileRequest) => unwrapData(
      await profileApiService.updateMyProfile(changes),
      'Update profile',
    ),
    onSuccess: (data, changes) => {
      setProfileDraft(current => {
        const remaining = {...current};
        for (const key of Object.keys(changes) as (keyof UpdateProfileRequest)[]) {
          const value = current[key];
          if ((typeof value === 'string' ? value.trim() : value) === changes[key]) delete remaining[key];
        }
        return remaining;
      });
      queryClient.setQueryData(['my-profile'], data);
      updateProfile({name: formatPersonName(data), avatar: data.avatarUrl});
      setStatus({kind: 'success', key: 'settings:saved'});
    },
    onError: error => setStatus({kind: 'error', key: 'settings:saveFailed', error}),
  });

  const changePassword = useMutation({
    mutationFn: () => {
      const request = {currentPassword, newPassword};
      const operation = 'auth-change-password';
      return authApiService.changePassword(
        request,
        idempotency.keyFor(operation, idempotencyFingerprint(request)),
      );
    },
    onSuccess: () => {
      const request = {currentPassword, newPassword};
      const operation = 'auth-change-password';
      idempotency.completeFingerprint(operation, idempotencyFingerprint(request));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatus({kind: 'success', key: 'settings:passwordUpdated'});
    },
    onError: error => setStatus({kind: 'error', key: 'settings:passwordUpdateFailed', error}),
  });

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    if (!currentPassword) {
      setStatus({kind: 'error', key: 'settings:currentPasswordRequired'});
      return;
    }
    if (!isValidPassword(newPassword)) {
      setStatus({kind: 'error', key: 'auth:signupErrors.passwordFormat'});
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({kind: 'error', key: 'settings:passwordMismatch'});
      return;
    }
    changePassword.mutate();
  };

  if (!tenantAdmin && profileQuery.isLoading) return <div className={styles.settingsPageWrapper}>{t('settings:loading')}</div>;
  if (!tenantAdmin && profileQuery.isError) {
    return (
      <div className={styles.settingsPageWrapper} role="alert">
        {t('settings:loadFailed')}<button type="button" className={styles.primaryButton} onClick={() => void profileQuery.refetch()}>
          {t('common:actions.tryAgain')}</button>
      </div>
    );
  }

  const profile = profileQuery.data;
  if (!tenantAdmin && !profile) return <div className={styles.settingsPageWrapper}>{t('settings:loadFailed')}</div>;

  return (
    <div className={styles.settingsPageWrapper}>
      <div className={styles.settingsHeader}>
        <button
          type="button"
          className={styles.backButton}
          onClick={handleBack}
          aria-label={t('common:actions.back')} title={t('common:actions.back')}
        >
          <ArrowLeft size={20} aria-hidden="true"/>
        </button>
        <div className={styles.settingsHeaderText}>
          <h2 className={styles.settingsTitle}>{t('common:menu.settings')}</h2>
          <p className={styles.settingsSubtitle}>{t('settings:subtitle')}</p>
        </div>
      </div>
      <div className={styles.tabsContainer} role="tablist" aria-label={t('settings:sections')}>
        {(tenantAdmin ? ['Password'] as const : tabList).map(tab => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? `${styles.tab} ${styles.activeTab}` : styles.tab}
            onClick={() => {
              setActiveTab(tab);
              setStatus(null);
            }}
          >
            {t(tab === 'Account' ? 'auth:signup.steps.account' : tab === 'Password' ? 'auth:login.passwordLabel' : 'navigation:parent.notifications')}
          </button>
        ))}
      </div>
      <div className={styles.tabDivider}/>
      {LANGUAGE_SWITCHER_ENABLED ? <LanguageSwitcher/> : null}
      {status ? (
        <p className={status.kind === 'success' ? styles.successMessage : styles.errorMessage} role="status">
          {status.error ? getApiErrorMessage(status.error, t(status.key)) : t(status.key)}
        </p>
      ) : null}

      {activeTab === 'Account' && profile && (
        <section className={styles.generalSection}>
          <h3 className={styles.generalTitle}>{t('auth:signup.steps.account')}</h3>
          <p className={styles.generalSubtitle}>{t('settings:accountHelp')}</p>
          <form
            noValidate
            className={styles.generalForm}
            onSubmit={event => {
              event.preventDefault();
              setStatus(null);
              if (!firstName.trim() || !lastName.trim()) {
                setStatus({kind: 'error', key: !firstName.trim() ? 'operations:directory.validation.firstName' : 'operations:directory.validation.lastName'});
                return;
              }
              saveProfile.mutate({firstName: firstName.trim(), middleName: middleName.trim(), lastName: lastName.trim(), phone: phone.trim()});
            }}
          >
            <div className={styles.inputGroup}>
              <label htmlFor="firstName">{t('auth:signup.firstNameLabel')}</label>
              <input id="firstName" value={firstName} onChange={event => editProfileField('firstName', event.target.value)} required maxLength={100}/>
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="middleName">{t('auth:signup.middleNameLabel')}</label>
              <input id="middleName" value={middleName} onChange={event => editProfileField('middleName', event.target.value)} maxLength={100}/>
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="lastName">{t('auth:signup.lastNameLabel')}</label>
              <input id="lastName" value={lastName} onChange={event => editProfileField('lastName', event.target.value)} required maxLength={100}/>
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="phone">{t('settings:phone')}</label>
              <input id="phone" value={phone} onChange={event => editProfileField('phone', event.target.value)} maxLength={64} autoComplete="tel"/>
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="email">{t('auth:login.emailLabel')}</label>
              <input id="email" type="email" value={profile.email} readOnly aria-readonly="true"/>
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="role">{t('settings:accountRole')}</label>
              <input
                id="role"
                value={[profile.role, profile.level].filter(Boolean).map(value => roleLabel(value)).join(' · ')}
                readOnly
                aria-readonly="true"
              />
            </div>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={saveProfile.isPending || !firstName.trim() || !lastName.trim()}
            >
              {saveProfile.isPending ? t('settings:saving') : t('settings:saveAccount')}
            </button>
          </form>
        </section>
      )}

      {activeTab === 'Password' && (
        <section className={styles.generalSection}>
          <h3 className={styles.generalTitle}>{t('auth:login.passwordLabel')}</h3>
          <p className={styles.generalSubtitle}>{t('auth:forgotPassword.newPasswordSubtitle')}</p>
          <form noValidate className={styles.generalForm} onSubmit={submitPassword}>
              <div className={styles.inputGroup}>
                <label htmlFor="currentPassword">{t('settings:currentPassword')}</label>
                <div className={styles.passwordInputWrapper}>
                  <input
                    id="currentPassword"
                    type={showOldPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={event => setCurrentPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder={t('settings:enterCurrentPassword')}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    aria-label={showOldPassword ? t('settings:hideCurrentPassword') : t('settings:showCurrentPassword')}
                    onClick={() => setShowOldPassword(value => !value)}
                  >
                    {showOldPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="newPassword">{t('settings:newPassword')}</label>
                <div className={styles.passwordInputWrapper}>
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={event => setNewPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder={t('auth:forgotPassword.newPasswordPlaceholder')}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    aria-label={showNewPassword ? t('settings:hideNewPassword') : t('settings:showNewPassword')}
                    onClick={() => setShowNewPassword(value => !value)}
                  >
                    {showNewPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword">{t('settings:confirmNewPassword')}</label>
                <div className={styles.passwordInputWrapper}>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder={t('settings:confirmNewPassword')}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    aria-label={showConfirmPassword ? t('settings:hideConfirmPassword') : t('settings:showConfirmPassword')}
                    onClick={() => setShowConfirmPassword(value => !value)}
                  >
                    {showConfirmPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>
            <button type="submit" className={styles.primaryButton} disabled={changePassword.isPending}>
              {changePassword.isPending ? t('settings:updating') : t('settings:updatePassword')}
            </button>
          </form>
        </section>
      )}

      {activeTab === 'Notifications' && (
        <section className={styles.generalSection}>
          <h3 className={styles.generalTitle}>{t('settings:emailNotifications')}</h3>
          <p className={styles.generalSubtitle}>{t('settings:notificationHelp')}</p>
          <form
            className={styles.generalForm}
            onSubmit={event => {
              event.preventDefault();
              setStatus(null);
              saveProfile.mutate({emailNotifications});
            }}
          >
            <label className={styles.notificationRow}>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={event => editProfileField('emailNotifications', event.target.checked)}
              />
              <span>{t('settings:receiveNotifications')}</span>
            </label>
            <button type="submit" className={styles.primaryButton} disabled={saveProfile.isPending}>
              {saveProfile.isPending ? t('settings:saving') : t('settings:saveNotifications')}
            </button>
          </form>
        </section>
      )}
    </div>
  );
};

export default SettingsPage;
