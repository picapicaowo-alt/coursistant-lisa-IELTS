import {IdempotencyCheckpoint, idempotencyFingerprint} from '@/hooks/useIdempotencyCheckpoint';

type MessageDraft = {body: string; files: File[]};

/** Keep both deduplication identifiers stable when delivery times out. */
export const sendStableMessage = async <T>(
  checkpoint: IdempotencyCheckpoint,
  scope: string,
  draft: MessageDraft,
  send: (message: MessageDraft & {clientMessageId: string}, key: string) => Promise<T>,
): Promise<T> => {
  const fingerprint = idempotencyFingerprint(draft);
  const operation = `${scope}-client-message`;
  const clientMessageId = checkpoint.keyFor(operation, fingerprint);
  const result = await checkpoint.run(`${scope}-send`, draft, key => send({...draft, clientMessageId}, key));
  checkpoint.completeFingerprint(operation, fingerprint);
  return result;
};
