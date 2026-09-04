import type {ComponentProps} from 'react';
import {PersonCell} from '@/components/PersonCell';
import styles from './index.module.scss';

export function PersonSelectRow({person, secondary, roleLabel, name, value, selected, disabled, onSelect}: ComponentProps<typeof PersonCell> & {
  name: string;
  value: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return <label className={styles.row} data-selected={selected}>
    <PersonCell person={person} secondary={secondary} roleLabel={roleLabel}/>
    <input type="radio" name={name} value={value} checked={selected} disabled={disabled} onChange={onSelect}/>
  </label>;
}
