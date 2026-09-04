import {useTranslation} from 'react-i18next';
import {useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {formatPersonName} from '@/utils/personName';
import {getApiErrorMessage} from '@/utils/apiError';
import {TeachingPagination} from '@/components/TeachingWorkspace';
import {PersonSearchSelect} from '@/components/PersonSearchSelect';
import {PAGE_SIZE} from './records';

export interface SelectedStudent {id: number; name: string}

export function CourseStudentPicker({courseId, selected, onSelect}: {
  courseId: number;
  selected?: SelectedStudent;
  onSelect: (student?: SelectedStudent) => void;
}) {
  const {t} = useTranslation('common');
  const [search, setSearch] = useState('');
  const [queryText, setQueryText] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (search.trim() === queryText) return;
    const timeout = window.setTimeout(() => {setQueryText(search.trim()); setPage(0);}, 250);
    return () => window.clearTimeout(timeout);
  }, [search, queryText]);
  const query = useQuery({
    queryKey: ['course-members', courseId, 'report-picker', queryText, page],
    queryFn: async () => unwrapData(await courseApiService.listCourseMembers(courseId, {
      courseRole: 'Student', q: queryText || undefined, page, size: PAGE_SIZE,
    }), 'course students'),
    enabled: open,
    retry: false,
  });
  const options = (query.data?.items ?? []).map(item => ({
    value: String(item.userId),
    label: formatPersonName({firstName: item.userFirstName, middleName: item.userMiddleName, lastName: item.userLastName}, item.userName || t('people.studentFallback', {id: item.userId})),
    person: {id: item.userId, firstName: item.userFirstName, middleName: item.userMiddleName, lastName: item.userLastName, email: item.userEmail},
  }));
  return <PersonSearchSelect label={t('people.courseStudents')} search={search} onSearch={setSearch}
    onOpenChange={setOpen} options={options}
    selected={selected ? {value: String(selected.id), label: selected.name, person: {id: selected.id, firstName: selected.name}} : undefined}
    onSelect={option => onSelect(option ? {id: Number(option.value), name: option.label} : undefined)}
    loading={query.isPending || search.trim() !== queryText}
    error={query.isError ? getApiErrorMessage(query.error, t('people.studentLoadError')) : undefined}
    onRetry={() => void query.refetch()}
    footer={<TeachingPagination page={page} size={PAGE_SIZE} total={query.data?.total}
      count={query.data?.items.length ?? 0} loading={query.isFetching} onChange={setPage} label={t('people.students')}/>}/>;
}
