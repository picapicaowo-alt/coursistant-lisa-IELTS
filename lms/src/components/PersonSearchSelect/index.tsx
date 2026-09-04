import {useTranslation} from 'react-i18next';
import {useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode} from 'react';
import {Check, ChevronDown, Search, X} from 'lucide-react';
import {PersonCell} from '@/components/PersonCell';
import styles from './index.module.scss';

export interface PersonSearchOption extends ComponentProps<typeof PersonCell> {
  value: string;
  label: string;
}

/** Accessible selection UI; callers own queries, pagination and authorized mutations. */
export function PersonSearchSelect({label, selected, options, search, onSearch, onSelect, loading, error, onRetry, footer, required = false, onOpenChange}: {
  label: string;
  selected?: PersonSearchOption;
  options: PersonSearchOption[];
  search: string;
  onSearch: (search: string) => void;
  onSelect: (option?: PersonSearchOption) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  footer?: ReactNode;
  required?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const id = useId();
  const {t} = useTranslation('common');
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string>();
  const visibleOptions = loading || error ? [] : options;
  const activeIndex = visibleOptions.findIndex(option => option.value === activeValue);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
    if (!next) setActiveValue(undefined);
  };

  useEffect(() => {
    // Typed search text alone is not a valid person selection.
    input.current?.setCustomValidity(required && !selected ? t('people.selectRequired', {label: label.toLowerCase()}) : '');
  }, [label, required, selected, t]);

  useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({block: 'nearest'});
  }, [activeIndex, id, open]);

  const choose = (option: PersonSearchOption) => {
    onSelect(option);
    onSearch('');
    // Pagination/retry can own focus. Restore it before closing, because focus opens results.
    input.current?.focus();
    changeOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      changeOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      changeOpen(true);
      const next = event.key === 'ArrowDown' ? Math.min(activeIndex + 1, visibleOptions.length - 1) : activeIndex < 0 ? visibleOptions.length - 1 : Math.max(0, activeIndex - 1);
      setActiveValue(visibleOptions[next]?.value);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (visibleOptions[activeIndex]) choose(visibleOptions[activeIndex]);
    }
  };

  return <div ref={root} className={styles.picker} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) changeOpen(false);
  }}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.control}>
      <Search size={18} aria-hidden="true"/>
      <input ref={input} id={id} name={`${id}-search`} role="combobox" aria-autocomplete="list"
        aria-expanded={open} aria-controls={open ? `${id}-results` : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        autoComplete="off" spellCheck={false} required={required && !selected} maxLength={100}
        placeholder={t('people.searchPlaceholder')} value={open ? search : selected?.label ?? search}
        onFocus={() => changeOpen(true)} onClick={() => changeOpen(true)} onKeyDown={onKeyDown}
        onChange={event => {onSearch(event.target.value); if (selected) onSelect(undefined); setActiveValue(undefined); changeOpen(true);}}/>
      {search || selected ? <button type="button" className={styles.iconButton} aria-label={t('people.clear', {label: label.toLowerCase()})}
        onClick={() => {onSelect(undefined); onSearch(''); setActiveValue(undefined); input.current?.focus(); changeOpen(true);}}><X size={18} aria-hidden="true"/></button> :
        <button type="button" className={styles.iconButton} aria-label={t('people.showOptions', {label: label.toLowerCase()})} aria-expanded={open}
          onClick={() => {input.current?.focus(); changeOpen(!open);}}><ChevronDown size={18} aria-hidden="true"/></button>}
    </div>
    {open ? <div className={styles.dropdown}>
      <div id={`${id}-results`} role="listbox" aria-label={t('people.results', {label})} aria-busy={loading} className={styles.results}>
        {visibleOptions.map((option, index) => <button type="button" role="option" tabIndex={-1}
          id={`${id}-option-${index}`} key={option.value} aria-selected={selected?.value === option.value}
          className={styles.option} data-active={index === activeIndex}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
          <PersonCell person={option.person} secondary={option.secondary} roleLabel={option.roleLabel}/>
          {selected?.value === option.value ? <Check size={18} aria-hidden="true"/> : null}
        </button>)}
      </div>
      {loading ? <p className={styles.status} role="status">{t('people.searching')}</p> : error ?
        <div className={styles.status} role="alert">{error} {onRetry ? <button type="button" onClick={onRetry}>{t('people.retry')}</button> : null}</div> :
        !options.length ? <p className={styles.status} role="status">{t('people.noMatches')}</p> : null}
      {!loading && !error ? footer : null}
    </div> : null}
  </div>;
}
