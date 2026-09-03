import {describe, expect, it} from 'vitest';
import {unwrapCursorData, unwrapPageData, type ApiResponse} from './common';

const envelope = <T,>(data: T): ApiResponse<T> => ({status: 200, code: 'SUCCESS', message: 'Success', timestamp: '', data});

describe('coordinated response cutover', () => {
  it('preserves an empty page beyond the last page and its total', () => {
    const data = {items: [], page: 3, size: 20, total: 21};
    expect(unwrapPageData(envelope(data), 'queue')).toBe(data);
  });

  it('rejects the old array shape rather than treating it as an empty list', () => {
    const old = envelope([]) as unknown as Parameters<typeof unwrapPageData>[0];
    expect(() => unwrapPageData(old, 'queue')).toThrow('unsupported response');
  });

  it('keeps server cursors even when they exceed the visible message IDs', () => {
    const data = {items: [{messageId: 5}], nextBeforeId: 700, hasMore: true};
    expect(unwrapCursorData(envelope(data), 'messages')).toBe(data);
    expect(unwrapCursorData(envelope({...data, hasMore: false}), 'messages').hasMore).toBe(false);
  });

  it('rejects a missing next cursor when the server advertises more messages', () => {
    expect(() => unwrapCursorData(envelope({items: [], hasMore: true}), 'messages')).toThrow('unsupported response');
  });
});
