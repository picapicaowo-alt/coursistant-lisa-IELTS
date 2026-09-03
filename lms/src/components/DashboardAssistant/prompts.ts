export type Audience = 'student' | 'instructor' | 'advisor';
export const prompts: Record<Audience, string[]> = {
  student: ['Explain a concept', 'Review my writing', 'Practice speaking', 'Study advice'],
  instructor: ['Plan a lesson', 'Create practice questions', 'Review course materials', 'Draft student feedback'],
  advisor: ['Review student progress', 'Prepare a study plan', 'Review learning goals', 'Plan a follow-up'],
};
