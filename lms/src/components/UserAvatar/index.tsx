import {useState} from 'react';
import {UserRound} from 'lucide-react';
import styles from './index.module.scss';

/** Unknown or unavailable photos use a neutral identity mark, never a sample person. */
export function UserAvatar({
  src,
  alt = '',
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  const classes = [styles.avatar, className].filter(Boolean).join(' ');
  return src && src !== failedSource ? (
    <img
      src={src}
      alt={alt}
      className={classes}
      onError={() => setFailedSource(src)}
    />
  ) : (
    <span
      className={classes}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={!alt || undefined}
    >
      <UserRound size="58%" aria-hidden="true" />
    </span>
  );
}
