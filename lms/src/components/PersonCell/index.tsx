import {useTranslation} from 'react-i18next';
import {UserAvatar} from '@/components/UserAvatar';
import {formatPersonName} from '@/utils/personName';
import styles from './index.module.scss';

interface PersonIdentity {
  id?: number;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatar?: string | null;
}

/** Presentation only: each caller retains its directory, role and selection rules. */
export function PersonCell({person, secondary, roleLabel, compact = false}: {
  person: PersonIdentity;
  secondary?: string;
  roleLabel?: string;
  compact?: boolean;
}) {
  const {t} = useTranslation('common');
  return <span className={styles.person} data-compact={compact || undefined}>
    <UserAvatar src={person.avatar} className={styles.avatar}/>
    <span className={styles.copy}>
      <strong>{formatPersonName(person, person.id ? t('people.userFallback', {id: person.id}) : t('people.nameUnavailable'))}</strong>
      {secondary || person.email ? <small>{secondary ?? person.email}</small> : null}
      {roleLabel ? <small>{roleLabel}</small> : null}
    </span>
  </span>;
}
