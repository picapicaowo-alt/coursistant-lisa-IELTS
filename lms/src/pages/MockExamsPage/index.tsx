import React from 'react';
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

  const mode = user.role === 'SYSTEM_ADMIN'
    ? 'system'
    : user.role === 'TENANT_ADMIN'
      ? 'tenant'
    : user.level === 'STUDENT'
      ? 'student'
      : user.level === 'ADVISOR' || user.level === 'INSTRUCTOR_ADVISOR'
        ? 'advisor'
        : user.level === 'INSTRUCTOR'
          ? 'instructor'
          : 'unsupported';

  const data = useQuery({
    queryKey: ['mock-exams', mode],
    enabled: mode !== 'unsupported',
    retry: false,
    queryFn: async () => {
      if (mode === 'system') return unwrapData(await mockExamApiService.getSystemExams(), 'systemMockExams');
      if (mode === 'tenant') return unwrapData(await mockExamApiService.listTenantTemplates(), 'tenantMockExamTemplates');
      if (mode === 'student') return unwrapData(await mockExamApiService.listStudentExams(), 'studentMockExams');
      if (mode === 'advisor') return unwrapData(await mockExamApiService.listAdvisorTemplates(), 'advisorMockExamTemplates');
      return unwrapData(await mockExamApiService.listInstructorWritingGrades(), 'instructorWritingGrades');
    },
  });

  if (mode === 'student') {
    return (
      <main className={studentStyles.studentPage}>
        <header className={studentStyles.masthead}>
          <div>
            <p className={studentStyles.brand}>Mock<em>Lab</em></p>
            <p className={studentStyles.kicker}>IELTS academic examination room</p>
          </div>
          <div className={studentStyles.intro}>
            <h1>Choose a paper. Enter exam mode.</h1>
            <p>Your assigned Listening, Reading and Writing papers use official section timing and keep every tool within reach.</p>
          </div>
        </header>

        {data.isPending ? <p className={styles.status} role="status">Loading assigned papers…</p> : null}
        {data.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(data.error, 'Mock-exam data could not be loaded.')}</p> : null}
        {data.data !== undefined ? <StudentMockExamLibrary value={data.data}/> : null}
      </main>
    );
  }

  if (mode !== 'unsupported' && data.data !== undefined) {
    if (mode === 'tenant') return <TenantWorkspace value={data.data}/>;
    if (mode === 'advisor') return <AdvisorWorkspace value={data.data}/>;
    if (mode === 'instructor') return <InstructorWorkspace value={data.data}/>;
    if (mode === 'system') return <SystemWorkspace value={data.data}/>;
  }

  return (
    <main className={styles.page}>
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
