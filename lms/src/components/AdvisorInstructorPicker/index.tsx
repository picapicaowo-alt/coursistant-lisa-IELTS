import {useId, useRef, useState} from 'react';
import {ChevronDown, Search} from 'lucide-react';
import pickerStyles from './index.module.scss';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {formatPersonName} from '@/utils/personName';
import {advisingErrorMessage} from '@/pages/advising/advisingErrors';
import {AdvisingPagination} from '@/pages/advising/AdvisingPagination';
import styles from '@/pages/advising/advising.module.scss';

export function AdvisorInstructorPicker({value, onChange, label = 'Instructor', required = false, compact = false, appearance = 'default'}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  compact?: boolean;
  appearance?: 'default' | 'disclosure';
}) {
  const labelId = useId();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const instructors = useQuery({
    queryKey: ['advisor', 'instructors', q, page],
    queryFn: async () => unwrapData(await advisorApiService.listInstructors({q: q.trim() || undefined, page, size: ADVISOR_PAGE_SIZE}), 'advisorListInstructors'),
    retry: false,
  });
  const searchField = <label>Search instructors<input type="search" maxLength={100} value={q} onChange={event => {setQ(event.target.value); setPage(0);}}/></label>;
  const fields = <fieldset className={styles.form} data-compact={compact || undefined}>
    <legend>{label}</legend>
    {!compact ? searchField : null}
    <label>{label}<select required={required} value={value} onChange={event => {
      onChange(event.target.value);
      setSelectedLabel(event.target.selectedOptions[0]?.textContent ?? '');
      if (disclosure.current && event.target.value) {disclosure.current.open = false; disclosure.current.querySelector('summary')?.focus();}
    }}>
      <option value="">Select instructor</option>
      {value && !instructors.data?.items.some(item => String(item.instructorUserId) === value) ? <option value={value}>Selected instructor #{value}</option> : null}
      {instructors.data?.items.map(item => <option key={item.instructorUserId} value={item.instructorUserId}>{formatPersonName(item)}{item.email ? ` · ${item.email}` : ''}</option>)}
    </select></label>
    {compact ? <details><summary>Search instructors</summary>{searchField}</details> : null}
    {instructors.isPending ? <p role="status">Loading instructors…</p> : null}
    {instructors.isError ? <p role="alert">{advisingErrorMessage(instructors.error, 'Instructors could not be loaded.')} <button type="button" onClick={() => void instructors.refetch()}>Retry</button></p> : null}
    {!instructors.isPending && !instructors.isError && instructors.data?.items.length === 0 ? <p>No matching instructors.</p> : null}
    <AdvisingPagination label="Instructor pages" page={page} total={instructors.data?.total ?? 0} onPage={setPage}/>
  </fieldset>;
  if (appearance === 'default') return fields;

  const currentInstructor = instructors.data?.items.find(item => String(item.instructorUserId) === value);
  const selection = currentInstructor ? formatPersonName(currentInstructor) : selectedLabel || `Selected instructor #${value}`;
  return <div className={pickerStyles.picker}>
    <span id={labelId} className={pickerStyles.label}>{label}</span>
    <details ref={disclosure} className={pickerStyles.disclosure}>
      <summary aria-labelledby={labelId}>
        <Search size={20} aria-hidden="true"/>
        <span>{value ? selection : 'Search for available instructors…'}</span>
        <ChevronDown size={18} aria-hidden="true"/>
      </summary>
      <div className={pickerStyles.options}>{fields}</div>
    </details>
  </div>;
}
