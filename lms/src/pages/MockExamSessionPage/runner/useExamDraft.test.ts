import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {useExamDraft} from './useExamDraft';

const identity = vi.hoisted(() => ({userId: 301}));
vi.mock('@/contexts/RequiredAuthContext', () => ({useRequiredAuth: () => ({user: identity})}));
beforeEach(() => {sessionStorage.clear(); identity.userId = 301;});
afterEach(() => {cleanup(); vi.restoreAllMocks();});

it('deducts elapsed time after reload and isolates students, exams and sections', () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(100000);
  const first = renderHook(() => useExamDraft(77, 'writing', 600));
  act(() => first.result.current.setAnswers({TASK1: 'A private response'}));
  act(() => first.result.current.setRemainingSeconds(500));
  first.unmount();
  now.mockReturnValue(110000);
  const restored = renderHook(() => useExamDraft(77, 'writing', 600));
  expect(restored.result.current.answers.TASK1).toBe('A private response');
  expect(restored.result.current.remainingSeconds).toBe(490);
  expect(renderHook(() => useExamDraft(77, 'reading', 600)).result.current.answers).toEqual({});
  expect(renderHook(() => useExamDraft(78, 'writing', 600)).result.current.answers).toEqual({});
  identity.userId = 302;
  expect(renderHook(() => useExamDraft(77, 'writing', 600)).result.current.answers).toEqual({});
});

it('retains paused time and removes submitted responses without resurrecting them', () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(100000);
  const first = renderHook(() => useExamDraft(77, 'reading', 600));
  act(() => {first.result.current.setAnswers({1: 'TRUE'}); first.result.current.setPaused(true);});
  first.unmount();
  now.mockReturnValue(999000);
  const restored = renderHook(() => useExamDraft(77, 'reading', 600));
  expect(restored.result.current.remainingSeconds).toBe(600);
  expect(restored.result.current.paused).toBe(true);
  act(() => restored.result.current.clearDraft());
  act(() => restored.result.current.setRemainingSeconds(590));
  restored.unmount();
  expect(renderHook(() => useExamDraft(77, 'reading', 600)).result.current.answers).toEqual({});
});

it('keeps editing possible when the browser refuses storage and exposes that limitation', () => {
  vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {throw new DOMException('Full', 'QuotaExceededError');});
  const {result} = renderHook(() => useExamDraft(77, 'writing', 600));
  act(() => result.current.setAnswers({TASK1: 'Still editable'}));
  expect(result.current.answers.TASK1).toBe('Still editable');
  expect(result.current.storageUnavailable).toBe(true);
});

it('rejects a malformed stored answer instead of breaking the exam', () => {
  sessionStorage.setItem('coursistant:mock-exam:301:77:reading', JSON.stringify({answers: {1: {}}, remainingSeconds: 500, paused: false, updatedAt: Date.now()}));
  const {result} = renderHook(() => useExamDraft(77, 'reading', 600));
  expect(result.current.answers).toEqual({});
  expect(result.current.remainingSeconds).toBe(600);
});
