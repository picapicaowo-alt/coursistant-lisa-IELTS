import type {StudySupportProgress} from './studySupportStream';
import type {ThinkingStep} from '@/components/DynamicThinking/DynamicThinking';

const SAFE_PHASE_KEYS: Readonly<Record<string, string>> = {
  understand: 'assistant:thinking.question',
  thinking: 'assistant:thinking.question',
  route: 'assistant:thinking.route',
  routing: 'assistant:thinking.route',
  search: 'assistant:thinking.search',
  retrieval: 'assistant:thinking.search',
  context: 'assistant:thinking.courseContext',
  tool: 'assistant:thinking.tools',
  tools: 'assistant:thinking.tools',
  writing: 'assistant:thinking.response',
  answer: 'assistant:thinking.response',
  response: 'assistant:thinking.response',
};

export const safeStudySupportProgress = (
  progress: StudySupportProgress,
  id: string,
): ThinkingStep => ({
  id,
  text: '',
  translationKey: SAFE_PHASE_KEYS[progress.phase.trim().toLowerCase()] ?? 'assistant:thinking.working',
});
