import {unwrapPageData} from '@/apis';
import React, {useState} from 'react';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {OPERATION_QUEUE_PAGE_SIZE as size, STUDENT_MOCK_EXAM_STATUSES} from '@/apis/types/operationQueues';
import {QueryFeedback} from '@/components/QueryFeedback';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {StudentMockExamLibrary} from './StudentMockExamLibrary';
import {AdvisorWorkspace, InstructorWorkspace, SystemWorkspace, TenantWorkspace} from './StaffMockExamWorkspaces';
import studentStyles from './index.module.scss';
import styles from '../advising/advising.module.scss';

const MockExamsPage: React.FC = () => {
  const {user} = useRequiredAuth();

  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [combinedMode, setCombinedMode] = useState<'advisor' | 'instructor'>('advisor');
  const mode = user.role === 'SYSTEM_ADMIN'
    ? 'system'
    : user.role === 'TENANT_ADMIN'
      ? 'tenant'
    : user.level === 'STUDENT'
      ? 'student'
      : user.level === 'INSTRUCTOR_ADVISOR'
        ? combinedMode
        : user.level === 'ADVISOR'
        ? 'advisor'
        : user.level === 'INSTRUCTOR'
          ? 'instructor'
          : 'unsupported';

  const data = useQuery({
    queryKey: ['mock-exams', mode, page, status],
    enabled: mode !== 'unsupported',
    placeholderData: (previous, query) => mode === 'student' && query?.queryKey[1] === mode ? previous : undefined,
    retry: false,
    queryFn: async () => {
      if (mode === 'system') return unwrapData(await mockExamApiService.getSystemExams(), 'systemMockExams');
      if (mode === 'tenant') return unwrapData(await mockExamApiService.listTenantTemplates(), 'tenantMockExamTemplates');
      if (mode === 'student') return unwrapPageData(await mockExamApiService.listStudentExams({page, size, status: status || undefined}), 'studentMockExams');
      if (mode === 'advisor') return unwrapData(await mockExamApiService.listAdvisorTemplates(), 'advisorMockExamTemplates');
      return unwrapPageData(await mockExamApiService.listInstructorWritingGrades({page, size}), 'instructorWritingGrades');
    },
  });

  const total = data.data && typeof data.data === 'object' && 'total' in data.data && typeof data.data.total === 'number' ? data.data.total : 0;
  const pagination = <AdvisingPagination label="Mock exam pages" page={page} size={size} total={total} onPage={setPage}/>;
  const switcher = user.level === 'INSTRUCTOR_ADVISOR' ? <nav className={styles.tabs} aria-label="Mock exam workspace"><button type="button" aria-pressed={combinedMode === 'advisor'} onClick={() => {setCombinedMode('advisor'); setPage(0);}}>Exam assignments</button><button type="button" aria-pressed={combinedMode === 'instructor'} onClick={() => {setCombinedMode('instructor'); setPage(0);}}>Writing grading</button></nav> : null;

  if (mode === 'student') {
    return (
      <main className={studentStyles.studentPage}>
        <header className={studentStyles.masthead}>
          <div className={studentStyles.intro}>
            <h1>Exams</h1>
            <p>Choose an assigned paper to practise Listening, Reading or Writing.</p>
          </div>
        </header>

        <label className={studentStyles.filters}>Exam status<select aria-label="Exam status" value={status} onChange={event => {setStatus(event.target.value); setPage(0);}}><option value="">All states</option>{STUDENT_MOCK_EXAM_STATUSES.map(value => <option key={value}>{value}</option>)}</select></label>
        <QueryFeedback pending={data.isPending} error={data.error} onRetry={() => void data.refetch()}/>
        {data.isSuccess ? <><StudentMockExamLibrary value={data.data} serverStatusFilter/>{pagination}</> : null}
      </main>
    );
  }

  if (mode !== 'unsupported' && data.data !== undefined) {
    if (mode === 'tenant') return <TenantWorkspace value={data.data}/>;
    if (mode === 'advisor') return <>{switcher}<AdvisorWorkspace value={data.data}/></>;
    if (mode === 'instructor') return <>{switcher}<InstructorWorkspace key={page} value={data.data}/>{pagination}</>;
    if (mode === 'system') return <SystemWorkspace value={data.data}/>;
  }

  return (
    <main className={styles.page}>
      {switcher}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Assessment</p>
          <h1>Mock exams</h1>
          <p className={styles.lede}>IELTS mock-exam tools available for your account.</p>
        </div>
      </header>

      {mode === 'unsupported' ? <p className={styles.status}>Mock-exam operations are not available for this account type.</p> : null}
      {data.isPending ? <p className={styles.status}>Loading…</p> : null}
      {data.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(data.error, 'Mock-exam data could not be loaded.')}</p> : null}
    </main>
  );
};

export default MockExamsPage;
