/** PENDING is the legacy projection; PENDING_INSTRUCTOR is never an Advisor action. */
export const isAdvisorSchedulePending = (status?: string): boolean =>
  status === 'PENDING' || status === 'PENDING_ADVISOR';
