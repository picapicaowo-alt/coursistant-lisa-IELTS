import {useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import styles from './styles.module.scss';
import type {ProfileResponse} from '@/apis';
import {unwrapData} from '@/apis';
import {profileApiService} from '@/apis/services/profile-api';
import {useAuth} from '@/contexts/AuthContext';
import {getApiErrorMessage} from '@/utils/apiError';
import {normalizeAvatarUrl} from '@/utils/avatarUrl';
import {formatPersonName} from '@/utils/personName';

interface StatusMessage {
  kind: 'success' | 'error';
  text: string;
}

const ProfilePage = () => {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const {updateProfile} = useAuth();

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
      setStatus({kind: 'success', text: 'Profile updated.'});
    },
    onError: error => setStatus({kind: 'error', text: getApiErrorMessage(error, 'Could not update profile.')}),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => unwrapData(await profileApiService.uploadAvatar(file), 'Upload avatar'),
    onSuccess: data => {
      commitProfile(data);
      setStatus({kind: 'success', text: 'Avatar updated.'});
    },
    onError: error => setStatus({kind: 'error', text: getApiErrorMessage(error, 'Could not upload avatar.')}),
  });

  const deleteAvatar = useMutation({
    mutationFn: async () => unwrapData(await profileApiService.deleteAvatar(), 'Delete avatar'),
    onSuccess: data => {
      commitProfile(data);
      setStatus({kind: 'success', text: 'Avatar removed.'});
    },
    onError: error => setStatus({kind: 'error', text: getApiErrorMessage(error, 'Could not remove avatar.')}),
  });

  if (profileQuery.isLoading) return <main className={styles.profilePage}>Loading profile…</main>;
  if (profileQuery.isError) {
    return (
      <main className={styles.profilePage} role="alert">
        Could not load profile.
        <button type="button" className={styles.secondaryButton} onClick={() => void profileQuery.refetch()}>
          Try again
        </button>
      </main>
    );
  }

  const profile = profileQuery.data;
  if (!profile) return <main className={styles.profilePage}>Could not load profile.</main>;
  const avatar = normalizeAvatarUrl(profile.avatarUrl) || '/icons/default_avatar.jpg';

  return (
    <main className={styles.profilePage}>
      <div className={styles.profileCover}/>
      <section className={styles.profileCard} aria-labelledby="profile-title">
        <div className={styles.avatarColumn}>
          <img
            src={avatar}
            alt="Profile avatar"
            className={styles.profileAvatar}
            onError={event => {
              event.currentTarget.src = '/icons/default_avatar.jpg';
            }}
          />
          <input
            ref={fileInputRef}
            className={styles.visuallyHidden}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) uploadAvatar.mutate(file);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAvatar.isPending}
          >
            Change avatar
          </button>
          {profile.avatarUrl ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => deleteAvatar.mutate()}
              disabled={deleteAvatar.isPending}
            >
              Remove avatar
            </button>
          ) : null}
        </div>

        <div className={styles.profileDetails}>
          <div className={styles.profileHeading}>
            <div>
              <p className={styles.eyebrow}>PROFILE</p>
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
                Edit profile
              </button>
            ) : null}
          </div>
          {status ? (
            <p role="status" className={status.kind === 'success' ? styles.profileSuccess : styles.profileError}>
              {status.text}
            </p>
          ) : null}

          {editing ? (
            <form
              className={styles.profileForm}
              onSubmit={event => {
                event.preventDefault();
                updateName.mutate();
              }}
            >
              <label htmlFor="profile-first-name">First name</label>
              <input id="profile-first-name" value={firstName} onChange={event => setFirstName(event.target.value)} required autoFocus maxLength={100}/>
              <label htmlFor="profile-middle-name">Middle name</label>
              <input id="profile-middle-name" value={middleName} onChange={event => setMiddleName(event.target.value)} maxLength={100}/>
              <label htmlFor="profile-last-name">Last name</label>
              <input id="profile-last-name" value={lastName} onChange={event => setLastName(event.target.value)} required maxLength={100}/>
              <label htmlFor="profile-phone">Phone</label>
              <input id="profile-phone" value={phone} onChange={event => setPhone(event.target.value)} maxLength={64} autoComplete="tel"/>
              <div className={styles.profileActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={updateName.isPending || !firstName.trim() || !lastName.trim()}
                >
                  {updateName.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          ) : (
            <dl className={styles.profileFacts}>
              <div><dt>Email</dt><dd>{profile.email}</dd></div>
              <div><dt>Account role</dt><dd>{profile.role}</dd></div>
              <div><dt>Level</dt><dd>{profile.level || 'Not applicable'}</dd></div>
              <div><dt>Email notifications</dt><dd>{profile.emailNotifications ? 'Enabled' : 'Disabled'}</dd></div>
            </dl>
          )}
        </div>
      </section>
    </main>
  );
};

export default ProfilePage;
