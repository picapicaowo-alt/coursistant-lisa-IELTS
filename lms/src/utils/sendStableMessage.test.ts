import {describe, expect, it, vi} from 'vitest';
import {IdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {sendStableMessage} from './sendStableMessage';

describe('message delivery', () => {
  it('retries with both identifiers, then rotates them for the next successful message', async () => {
    const checkpoints = new IdempotencyCheckpoint();
    const send = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue('sent');
    const draft = {body: 'Please review my essay.', files: []};
    await expect(sendStableMessage(checkpoints, 'student', draft, send)).rejects.toThrow('timeout');
    await sendStableMessage(checkpoints, 'student', draft, send);
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
    await sendStableMessage(checkpoints, 'student', draft, send);
    expect(send.mock.calls[2][0].clientMessageId).not.toBe(send.mock.calls[1][0].clientMessageId);
    expect(send.mock.calls[2][1]).not.toBe(send.mock.calls[1][1]);
  });
  it('separates student identities and changed payloads', async () => {
    const checkpoints = new IdempotencyCheckpoint();
    const send = vi.fn().mockRejectedValue(new Error('timeout'));
    for (const [scope, body] of [['parent-1', 'First'], ['parent-2', 'First'], ['parent-1', 'Changed']]) {
      await sendStableMessage(checkpoints, scope, {body, files: []}, send).catch(() => undefined);
    }
    expect(new Set(send.mock.calls.map(call => call[0].clientMessageId)).size).toBe(3);
  });
});
