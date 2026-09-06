import { useTranslation } from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import {roleLabel} from '@/i18n/presentation';
import {UserAvatar} from '@/components/UserAvatar';
import {useEffect, useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {AvatarCropDialog} from './AvatarCropDialog';
import styles from './styles.module.scss';
import type {ProfileResponse} from '@/apis';
import {unwrapData} from '@/apis';
import {profileApiService} from '@/apis/services/profile-api';
import {useAuth} from '@/contexts/AuthContext';
import {getApiErrorMessage} from '@/utils/apiError';
import {normalizeAvatarUrl} from '@/utils/avatarUrl';
import {formatPersonName} from '@/utils/personName';
import {isStudentAccount} from '@/utils/roleCapabilities';
import {useLearningProfile} from './useLearningProfile';
import {LearningProfileDetails, LearningProfileSummary} from './LearningProfile';

interface StatusMessage {
  kind: 'success' | 'error';
  key: string;
  error?: unknown;
}

const ProfilePage = () => {
  const { t: translate } = useTranslation();
  const [editing, setEditing] = useState(false);
  const editDialog = useRef<HTMLDialogElement>(null);
  const [cropFile, setCropFile] = useState<File>();
  useEffect(() => {if (editing) editDialog.current?.showModal();}, [editing]);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const {updateProfile, user} = useAuth();
  const isStudent = Boolean(user && isStudentAccount(user));
  const learningProfile = useLearningProfile(isStudent);

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => unwrapData(await profileApiService.getMyProfile(), 'Load profile'),
  });

  const commitProfile = (data: ProfileResponse) => {
    queryClient.setQueryData(['my-profile'], data);
    updateProfile({name: formatPersonName(data), avatar: data.avatarUrl});
  };

  const updateName = useMutation({
    mutationFn: async () => unwrapData(
      await profileApiService.updateMyProfile({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      }),
      'Update profile',
    ),
    onSuccess: data => {
      commitProfile(data);
      setEditing(false);
      setStatus({kind: 'success', key: 'settings:profile.saved'});
    },
    onError: error => setStatus({kind: 'error', key: 'settings:profile.saveFailed', error}),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => unwrapData(await profileApiService.uploadAvatar(file), 'Upload avatar'),
    onSuccess: data => {
      commitProfile(data);
      setStatus({kind: 'success', key: 'settings:avatar.updated'});
      setCropFile(undefined);
    },
    onError: error => setStatus({kind: 'error', key: 'settings:avatar.uploadFailed', error}),
  });

  const deleteAvatar = useMutation({
    mutationFn: async () => unwrapData(await profileApiService.deleteAvatar(), 'Delete avatar'),
    onSuccess: data => {
      commitProfile(data);
      setStatus({kind: 'success', key: 'settings:avatar.removed'});
    },
    onError: error => setStatus({kind: 'error', key: 'settings:avatar.removeFailed', error}),
  });

  if (profileQuery.isLoading) return <main className={styles.profilePage}>{translate("advising:profile.loading")}</main>;
  if (profileQuery.isError) {
    return (
      <main className={styles.profilePage} role="alert">
        {translate("settings:profile.loadFailed")}<button type="button" className={styles.secondaryButton} onClick={() => void profileQuery.refetch()}>
          {translate("common:actions.tryAgain")}</button>
      </main>
    );
  }

  const profile = profileQuery.data;
  if (!profile) return <main className={styles.profilePage}>{translate("settings:profile.loadFailed")}</main>;
  const avatar = normalizeAvatarUrl(profile.avatarUrl);

  return (
    <main className={styles.profilePage}>
      <section className={styles.profileCard} aria-labelledby="profile-title">
        <div className={styles.avatarColumn}>
          <UserAvatar src={avatar} alt={translate("settings:profile.avatar")} className={styles.profileAvatar}/>
          <input
            ref={fileInputRef}
            hidden
            className={styles.visuallyHidden}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) {uploadAvatar.reset(); setCropFile(file);}
              event.target.value = '';
            }}
          />
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAvatar.isPending}
          >
            {translate("settings:profile.changeAvatar")}</button>
          {profile.avatarUrl ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => deleteAvatar.mutate()}
              disabled={deleteAvatar.isPending}
            >
              {translate("settings:profile.removeAvatar")}</button>
          ) : null}
        </div>

        <div className={styles.profileDetails}>
          <div className={styles.profileHeading}>
            <div>
              <p className={styles.eyebrow}>{isStudent ? translate('advising:studentWorkspace.studentId', {id: formatNumber(profile.userId)}) : roleLabel(profile.role)}</p>
              <h1 id="profile-title">{formatPersonName(profile)}</h1>
            </div>
            {!editing ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setFirstName(profile.firstName || '');
                  setMiddleName(profile.middleName || '');
                  setLastName(profile.lastName || '');
                  setPhone(profile.phone || '');
                  setEditing(true);
                  setStatus(null);
                }}
              >
                {translate("settings:profile.edit")}</button>
            ) : null}
          </div>
          {status ? (
            <p role="status" className={status.kind === 'success' ? styles.profileSuccess : styles.profileError}>
              {getApiErrorMessage(status.error, translate(status.key))}
            </p>
          ) : null}

          {learningProfile.data ? <LearningProfileSummary profile={learningProfile.data}/> : (
            <dl className={styles.profileFacts}>
              <div><dt>{translate("common:fields.email")}</dt><dd>{profile.email}</dd></div>
              <div><dt>{translate("settings:accountRole")}</dt><dd>{roleLabel(profile.role)}</dd></div>
              <div><dt>{translate("records:fields.level")}</dt><dd>{roleLabel(profile.level) || translate("common:status.NOT_APPLICABLE")}</dd></div>
              <div><dt>{translate("settings:emailNotifications")}</dt><dd>{profile.emailNotifications ? translate("settings:profile.enabled") : translate("common:admin.status.DISABLED")}</dd></div>
            </dl>
          )}
        </div>
      </section>
      {isStudent && learningProfile.isPending ? <p role="status">{translate("learning:parent.loadingProfile")}</p> : null}
      {isStudent && learningProfile.isError ? <p role="alert">{translate("settings:profile.learningFailed")}{' '}<button type="button" className={styles.secondaryButton} onClick={() => void learningProfile.refetch()}>{translate("common:actions.retry")}</button></p> : null}
      {learningProfile.data ? <LearningProfileDetails profile={learningProfile.data}/> : null}
      {editing ? <dialog ref={editDialog} className={styles.editDialog} aria-labelledby="edit-profile-title" onClose={() => setEditing(false)} onCancel={event => {if (updateName.isPending) event.preventDefault();}}><h2 id="edit-profile-title">{translate("settings:profile.edit")}</h2>            <form
              className={styles.profileForm}
              noValidate
              onSubmit={event => {
                event.preventDefault();
                if (!updateName.isPending && firstName.trim() && lastName.trim()) updateName.mutate();
              }}
            >
              <label htmlFor="profile-first-name">{translate("common:fields.firstName")}</label>
              <input id="profile-first-name" value={firstName} onChange={event => setFirstName(event.target.value)} required autoFocus maxLength={100}/>
              <label htmlFor="profile-middle-name">{translate("auth:signup.middleNameLabel")}</label>
              <input id="profile-middle-name" value={middleName} onChange={event => setMiddleName(event.target.value)} maxLength={100}/>
              <label htmlFor="profile-last-name">{translate("common:fields.lastName")}</label>
              <input id="profile-last-name" value={lastName} onChange={event => setLastName(event.target.value)} required maxLength={100}/>
              <label htmlFor="profile-phone">{translate("settings:phone")}</label>
              <input id="profile-phone" value={phone} onChange={event => setPhone(event.target.value)} maxLength={64} autoComplete="tel"/>
              {status?.kind === 'error' ? <p role="alert" className={styles.profileError}>{getApiErrorMessage(status.error, translate(status.key))}</p> : null}
              <div className={styles.profileActions}>
                <button type="button" className={styles.secondaryButton} disabled={updateName.isPending} onClick={() => setEditing(false)}>
                  {translate("common:actions.cancel")}</button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={updateName.isPending || !firstName.trim() || !lastName.trim()}
                >
                  {updateName.isPending ? translate("common:actions.saving") : translate("common:actions.saveChanges")}
                </button>
              </div>
            </form>
</dialog> : null}
      {cropFile ? <AvatarCropDialog file={cropFile} pending={uploadAvatar.isPending} error={uploadAvatar.isError ? getApiErrorMessage(uploadAvatar.error, translate('settings:avatar.uploadFailed')) : undefined} onSave={file => uploadAvatar.mutate(file)} onClose={() => setCropFile(undefined)}/> : null}
    </main>
  );
};

export default ProfilePage;
