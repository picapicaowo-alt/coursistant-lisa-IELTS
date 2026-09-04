import {useTranslation} from 'react-i18next';
import {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {formatPersonName} from '@/utils/personName';
import {advisingErrorMessage} from '@/pages/advising/advisingErrors';
import {AdvisingPagination} from '@/pages/advising/AdvisingPagination';
import {PersonSearchSelect, type PersonSearchOption} from '@/components/PersonSearchSelect';

export function AdvisorInstructorPicker({value, onChange, label, required = false}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}) {
  const {t} = useTranslation('common');
  const [selection, setSelection] = useState<PersonSearchOption>();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (search.trim() === q) return;
    const timer = window.setTimeout(() => {setQ(search.trim()); setPage(0);}, 250);
    return () => window.clearTimeout(timer);
  }, [search, q]);
  const instructors = useQuery({
    queryKey: ['advisor', 'instructors', q, page],
    queryFn: async () => unwrapData(await advisorApiService.listInstructors({q: q || undefined, page, size: ADVISOR_PAGE_SIZE}), 'advisorListInstructors'),
    retry: false,
  });
  const options = useMemo<PersonSearchOption[]>(() => (instructors.data?.items ?? []).map(item => ({
    value: String(item.instructorUserId),
    label: formatPersonName(item),
    person: {...item, id: item.instructorUserId},
  })), [instructors.data?.items]);
  const current = options.find(option => option.value === value);
  useEffect(() => {
    if (current) setSelection(current);
    // Retain the chosen person's name when a later query/page excludes that person.
  }, [current]);
  const selected = value ? current ?? (selection?.value === value ? selection : {
    value, label: t('people.selectedInstructor', {id: value}), person: {id: Number(value)},
  }) : undefined;

  return <PersonSearchSelect label={label ?? t('people.instructor')} required={required} search={search} onSearch={setSearch}
    selected={selected} options={options} loading={instructors.isPending || search.trim() !== q}
    error={instructors.isError ? advisingErrorMessage(instructors.error, t('people.instructorLoadError')) : undefined}
    onRetry={() => void instructors.refetch()}
    onSelect={option => {setSelection(option); onChange(option?.value ?? '');}}
    footer={<AdvisingPagination label={t('people.instructorPages')} page={page} total={instructors.data?.total ?? 0} onPage={setPage}/>}/>;
}
