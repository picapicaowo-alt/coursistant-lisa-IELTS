export const advisingQueryKeys = {
  counsellorAll: ['counsellor'] as const,
  counsellorDashboard: ['counsellor', 'dashboard'] as const,
  counsellorIntakesAll: ['counsellor', 'intakes'] as const,
  counsellorIntakes: (page: number, size: number) => ['counsellor', 'intakes', page, size] as const,
  counsellorIntake: (intakeId: number) => ['counsellor', 'intake', intakeId] as const,
  counsellorAdvisors: (page: number, size: number) => ['counsellor', 'advisors', page, size] as const,
  advisorStudentsAll: ['advisor', 'students'] as const,
  advisorStudents: (page: number, size: number) => ['advisor', 'students', page, size] as const,
  advisorIntake: (studentUserId: number) => ['advisor', 'intake', studentUserId] as const,
  advisorProfile: (studentUserId: number) => ['advisor', 'profile', studentUserId] as const,
  advisorStudyPlan: (studentUserId: number) => ['advisor', 'study-plan', studentUserId] as const,
  advisorRevisions: (studentUserId: number, page: number) =>
    ['advisor', 'study-plan-revisions', studentUserId, page] as const,
  studentProfile: ['student', 'advising-profile'] as const,
  studentStudyPlan: ['student', 'advising-study-plan'] as const,
  tenantIntakes: (params: object) => ['tenant', 'intakes', params] as const,
  tenantProfile: (studentUserId: number) => ['tenant', 'profile', studentUserId] as const,
  tenantStudyPlan: (studentUserId: number) => ['tenant', 'study-plan', studentUserId] as const,
  tenantRevisions: (studentUserId: number, page: number) =>
    ['tenant', 'study-plan-revisions', studentUserId, page] as const,
};
