import {useEffect, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiResponseDataError, unwrapData, type AdvisingPage} from '@/apis';
import {counsellorApiService} from '@/apis/services/counsellor-api';
import {parentApiService} from '@/apis/services/parent-api';
import {parentLinkQueryKeys} from '@/components/ParentLinksPanel/queryKeys';
import {isNotFound} from '@/utils/apiError';
import {advisingQueryKeys} from '../advising/queryKeys';

function requirePage<T>(data: AdvisingPage<T>): AdvisingPage<T> {
  if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.page) || data.page < 0 ||
    !Number.isSafeInteger(data.size) || data.size <= 0 || !Number.isSafeInteger(data.total) || data.total < 0) {
    throw new ApiResponseDataError('The server returned an invalid directory page.');
  }
  return data;
}

export function useCounsellorDashboard(intakePageSize: number, advisorPageSize: number) {
  const client = useQueryClient();
  const [intakeOffset, setIntakeOffset] = useState(0);
  const [advisorOffset, setAdvisorOffset] = useState(0);
  // Preserve the current position when resizing changes the page capacity.
  const intakePage = Math.floor(intakeOffset / intakePageSize);
  const advisorPage = Math.floor(advisorOffset / advisorPageSize);
  const [requestedId, selectIntake] = useState<number | null>(null);
  const metrics = useQuery({
    queryKey: advisingQueryKeys.counsellorDashboard,
    queryFn: async () => unwrapData(await counsellorApiService.getDashboard(), 'counsellorDashboard'),
  });
  const intakes = useQuery({
    queryKey: advisingQueryKeys.counsellorIntakes(intakePage, intakePageSize),
    queryFn: async () => requirePage(unwrapData(await counsellorApiService.listStudentIntakes(intakePage, intakePageSize), 'listIntakes')),
  });
  const advisors = useQuery({
    queryKey: advisingQueryKeys.counsellorAdvisors(advisorPage, advisorPageSize),
    queryFn: async () => requirePage(unwrapData(await counsellorApiService.listAdvisors(advisorPage, advisorPageSize), 'listAdvisors')),
  });
  // Selection belongs to the current page. Never retain the previous student's
  // details while another page or identity is loading.
  const items = intakes.isError ? [] : intakes.data?.items ?? [];
  const selectedId = (items.find(item => item.intakeId === requestedId) ?? items[0])?.intakeId ?? null;
  const detail = useQuery({
    queryKey: selectedId === null ? ['counsellor', 'no-selection'] : advisingQueryKeys.counsellorIntake(selectedId),
    queryFn: async () => {
      if (selectedId === null) throw new Error('Select an intake first.');
      return unwrapData(await counsellorApiService.getStudentIntake(selectedId), 'getIntake');
    },
    enabled: selectedId !== null,
    retry: false,
  });
  const parents = useQuery({
    queryKey: selectedId === null ? ['parent-links', 'no-selection'] : parentLinkQueryKeys.subject('counsellor', selectedId),
    queryFn: async () => {
      if (selectedId === null) throw new Error('Select an intake first.');
      return unwrapData(await parentApiService.listCounsellorParentLinks(selectedId), 'parentLinks');
    },
    enabled: selectedId !== null && detail.isSuccess && !detail.isError,
    retry: false,
  });
  const unavailable = isNotFound(detail.error) || isNotFound(parents.error);

  useEffect(() => {
    if (!unavailable) return;
    // First assignment closes Counsellor access. Refresh the queue and counts,
    // without polling the now-inaccessible detail or reconstructing a history.
    void client.invalidateQueries({queryKey: advisingQueryKeys.counsellorIntakesAll});
    void client.invalidateQueries({queryKey: advisingQueryKeys.counsellorDashboard});
  }, [client, selectedId, unavailable]);

  useEffect(() => {
    const page = intakes.data;
    if (page && intakePage > 0 && page.items.length === 0 && page.total <= intakePage * intakePageSize) {
      setIntakeOffset(Math.max(0, page.total - 1));
    }
  }, [intakes.data, intakePage, intakePageSize]);

  useEffect(() => {
    const page = advisors.data;
    if (page && advisorPage > 0 && page.items.length === 0 && page.total <= advisorPage * advisorPageSize) {
      setAdvisorOffset(Math.max(0, page.total - 1));
    }
  }, [advisors.data, advisorPage, advisorPageSize]);

  return {
    metrics, intakes, advisors, detail, parents, selectedId, unavailable, selectIntake,
    changeIntakePage: (page: number) => { selectIntake(null); setIntakeOffset(page * intakePageSize); },
    changeAdvisorPage: (page: number) => setAdvisorOffset(page * advisorPageSize),
  };
}
