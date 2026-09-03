import {useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {UserRound} from 'lucide-react';
import {profileApiService} from '@/apis/services/profile-api';
import styles from './index.module.scss';

type AvatarProps = {src?: string | null; alt?: string; className?: string; userId?: number};

/** Unknown or unavailable photos use a neutral identity mark, never a sample person. */
export function UserAvatar(props: AvatarProps) {
  return !props.src && props.userId != null && props.userId > 0
    ? <UserAvatarFromApi {...props} userId={props.userId}/>
    : <AvatarImage {...props}/>;
}

function UserAvatarFromApi({userId, ...props}: AvatarProps & {userId: number}) {
  const avatar = useQuery({queryKey: ['user-avatar', userId], queryFn: () => profileApiService.getUserAvatar(userId), retry: false, staleTime: 5 * 60 * 1000});
  const [downloaded, setDownloaded] = useState<{blob: Blob; url: string}>();
  useEffect(() => {
    const blob = avatar.data;
    if (!(blob instanceof Blob) || !blob.type.startsWith('image/')) return;
    const url = URL.createObjectURL(blob);
    setDownloaded({blob, url});
    return () => URL.revokeObjectURL(url);
  }, [avatar.data]);
  // Identity changes must not briefly display the preceding person's cached photo.
  const src = downloaded?.blob === avatar.data ? downloaded?.url : undefined;
  return <AvatarImage {...props} src={src}/>;
}

function AvatarImage({src, alt = '', className}: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string>();
  const classes = [styles.avatar, className].filter(Boolean).join(' ');
  return src && src !== failedSource ? <img src={src} alt={alt} className={classes} onError={() => setFailedSource(src)}/> : <span className={classes} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={!alt || undefined}><UserRound size="58%" aria-hidden="true"/></span>;
}
