type ExamRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is ExamRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const numberFrom = (record: ExamRecord, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
};

export const resolveDashboardExamRoute = (exam: ExamRecord): string => {
  const id = numberFrom(exam, 'studentMockExamId', 'id');
  if (id === undefined || id <= 0) return '/mock-exams';
  const section = (['listening', 'reading', 'writing'] as const).find(name => {
    const titleCase = `${name[0].toUpperCase()}${name.slice(1)}`;
    return exam[`${name}Selected`] === true
      || exam[`has${titleCase}`] === true
      || isRecord(exam[name]);
  });
  return section ? `/mock-exams/${id}/${section}` : '/mock-exams';
};

export const dashboardExamActionLabel = (
  status: string,
  score: number | undefined,
  direct: boolean,
): string => {
  if (!direct) return 'Open exams';
  if (status.toLowerCase().includes('progress')) return 'Continue the exam';
  return score === undefined ? 'Open exam' : 'View results';
};
