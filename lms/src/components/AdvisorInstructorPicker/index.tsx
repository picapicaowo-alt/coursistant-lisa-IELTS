import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {formatPersonName} from '@/utils/personName';
import {advisingErrorMessage} from '@/pages/advising/advisingErrors';
import {AdvisingPagination} from '@/pages/advising/AdvisingPagination';
import styles from '@/pages/advising/advising.module.scss';

export function AdvisorInstructorPicker({value, onChange, label = 'Instructor', required = false, compact = false}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  compact?: boolean;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const instructors = useQuery({
    queryKey: ['advisor', 'instructors', q, page],
    queryFn: async () => unwrapData(await advisorApiService.listInstructors({q: q.trim() || undefined, page, size: ADVISOR_PAGE_SIZE}), 'advisorListInstructors'),
    retry: false,
  });
  const searchField = <label>Search instructors<input type="search" maxLength={100} value={q} onChange={event => {setQ(event.target.value); setPage(0);}}/></label>;
  return <fieldset className={styles.form} data-compact={compact || undefined}>
    <legend>{label}</legend>
    {!compact ? searchField : null}
    <label>{label}<select required={required} value={value} onChange={event => onChange(event.target.value)}>
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
}
