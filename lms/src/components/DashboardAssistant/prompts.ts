export type Audience = 'student' | 'instructor' | 'advisor';
export const prompts: Record<Audience, string[]> = {
  student: ['assistant:prompts.explain', 'assistant:prompts.reviewWriting', 'assistant:prompts.speaking', 'assistant:prompts.advice'],
  instructor: ['assistant:prompts.lesson', 'assistant:prompts.questions', 'assistant:prompts.materials', 'assistant:prompts.feedback'],
  advisor: ['assistant:prompts.progress', 'assistant:prompts.plan', 'assistant:prompts.goals', 'assistant:prompts.followUp'],
};
