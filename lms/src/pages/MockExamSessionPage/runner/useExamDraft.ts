import {useCallback, useEffect, useRef, useState} from 'react';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {mockExamSessionKey} from '@/utils/mockExamSessionStorage';

interface ExamDraft {
  answers: Record<string, string>;
  remainingSeconds: number;
  paused: boolean;
}

function restoreDraft(key: string, totalSeconds: number): ExamDraft {
  const empty: ExamDraft = {answers: {}, remainingSeconds: totalSeconds, paused: false};
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return empty;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('answers' in value) || !('remainingSeconds' in value)
      || !('paused' in value) || !('updatedAt' in value)) return empty;
    const {answers, remainingSeconds, paused, updatedAt} = value;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)
      || !Object.values(answers).every(answer => typeof answer === 'string')
      || typeof remainingSeconds !== 'number' || !Number.isFinite(remainingSeconds)
      || remainingSeconds < 0 || remainingSeconds > totalSeconds || typeof paused !== 'boolean'
      || typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return empty;
    // Reloading an active section must not grant extra time. A deliberately
    // paused practice section retains the time shown before the reload.
    const elapsed = paused ? 0 : Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
    return {answers: answers as Record<string, string>, remainingSeconds: Math.max(0, remainingSeconds - elapsed), paused};
  } catch {
    return empty;
  }
}

/** Same-tab recovery, scoped to the signed-in student and assigned exam. */
export function useExamDraft(examId: number, section: 'reading' | 'listening' | 'writing', totalSeconds: number) {
  const {user} = useRequiredAuth();
  const key = mockExamSessionKey(user.userId, examId, section);
  const [initial] = useState(() => restoreDraft(key, totalSeconds));
  const [answers, setAnswers] = useState(initial.answers);
  const [remainingSeconds, setRemainingSeconds] = useState(initial.remainingSeconds);
  const [paused, setPaused] = useState(initial.paused);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify({answers, remainingSeconds, paused, updatedAt: Date.now()}));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }, [answers, key, paused, remainingSeconds]);

  const clearDraft = useCallback(() => {
    submitted.current = true;
    try { window.sessionStorage.removeItem(key); } catch { /* Submission is already persisted by the API. */ }
  }, [key]);

  return {answers, setAnswers, remainingSeconds, setRemainingSeconds, paused, setPaused, clearDraft, storageUnavailable, studentUserId: user.userId};
}
