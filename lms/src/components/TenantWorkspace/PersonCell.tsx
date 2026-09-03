import type {ManagedUser} from '@/apis';
import {UserAvatar} from '@/components/UserAvatar';
import {formatPersonName} from '@/utils/personName';
import styles from './workspace.module.scss';

export function PersonCell({
  person,
  secondary,
}: {
  person: Pick<ManagedUser, 'firstName' | 'middleName' | 'lastName'> & {
    id?: number;
    email?: string;
    avatar?: string | null;
  };
  secondary?: string;
}) {
  return (
    <span className={styles.person}>
      <UserAvatar src={person.avatar} className={styles.avatar} />
      <span>
        <strong>
          {formatPersonName(
            person,
            person.id ? `User #${person.id}` : 'Name unavailable',
          )}
        </strong>
        {secondary || person.email ? (
          <small>{secondary ?? person.email}</small>
        ) : null}
      </span>
    </span>
  );
}
