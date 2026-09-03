import {act, renderHook} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it} from 'vitest';
import type {PropsWithChildren} from 'react';
import {useSectionDrafts} from './useSectionDrafts';

const wrapper = ({children}: PropsWithChildren) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('tenant exam tab drafts', () => {
  beforeEach(() => sessionStorage.clear());
  it('restores unsaved content only for the same account and template version', () => {
    const first = renderHook(() => useSectionDrafts(1, 48, 480), {wrapper});
    act(() =>
      first.result.current.setDrafts((all) => ({
        ...all,
        listening: {...all.listening, minutes: '40'},
      })),
    );
    first.unmount();
    const same = renderHook(() => useSectionDrafts(1, 48, 480), {wrapper});
    expect(same.result.current.drafts.listening.minutes).toBe('40');
    same.unmount();
    const otherAccount = renderHook(() => useSectionDrafts(2, 48, 480), {
      wrapper,
    });
    expect(otherAccount.result.current.drafts.listening.minutes).toBe('');
    otherAccount.unmount();
    const otherVersion = renderHook(() => useSectionDrafts(1, 48, 481), {
      wrapper,
    });
    expect(otherVersion.result.current.drafts.listening.minutes).toBe('');
  });
  it('ignores malformed local content instead of crashing the composer', () => {
    sessionStorage.setItem(
      'tenant-exam-draft:v1:1:48:480',
      '{"listening":{"minutes":"40","units":[]}}',
    );
    const restored = renderHook(() => useSectionDrafts(1, 48, 480), {wrapper});
    expect(restored.result.current.drafts.listening.units).toHaveLength(1);
    expect(restored.result.current.storageAvailable).toBe(true);
  });
  it('does not persist pristine identity-only drafts and restores legacy drafts without losing content', () => {
    const fresh = renderHook(() => useSectionDrafts(1, 48, 480), {wrapper});
    expect(sessionStorage.length).toBe(0);
    act(() =>
      fresh.result.current.setDrafts((all) => ({
        ...all,
        listening: {...all.listening, minutes: '40'},
      })),
    );
    fresh.unmount();
    const stored = sessionStorage.getItem('tenant-exam-draft:v1:1:48:480')!;
    sessionStorage.setItem(
      'tenant-exam-draft:v1:1:48:480',
      JSON.stringify(JSON.parse(stored), (key, value: unknown) =>
        key === 'draftId' ? undefined : value,
      ),
    );
    const restored = renderHook(() => useSectionDrafts(1, 48, 480), {wrapper});
    expect(restored.result.current.drafts.listening.minutes).toBe('40');
    expect(
      restored.result.current.drafts.listening.units[0].draftId,
    ).toBeTruthy();
    expect(
      restored.result.current.drafts.listening.units[0].questions[0].draftId,
    ).toBeTruthy();
  });
});
