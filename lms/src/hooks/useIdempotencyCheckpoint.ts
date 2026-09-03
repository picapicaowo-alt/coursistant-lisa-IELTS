import {useRef} from 'react';

interface Checkpoint {
  fingerprint: string;
  key: string;
}

/**
 * Keeps one retry key per logical operation until that operation succeeds.
 * A changed fingerprint represents a changed payload and receives a new key.
 */
export class IdempotencyCheckpoint {
  private checkpoints = new Map<string, Checkpoint>();

  keyFor(operation: string, fingerprint: string): string {
    const current = this.checkpoints.get(operation);
    if (current?.fingerprint === fingerprint) return current.key;

    const key = crypto.randomUUID();
    this.checkpoints.set(operation, {fingerprint, key});
    return key;
  }

  complete(operation: string, key: string): void {
    if (this.checkpoints.get(operation)?.key === key) {
      this.checkpoints.delete(operation);
    }
  }

  completeFingerprint(operation: string, fingerprint: string): void {
    if (this.checkpoints.get(operation)?.fingerprint === fingerprint) {
      this.checkpoints.delete(operation);
    }
  }

  async run<TPayload, T>(operation: string, payload: TPayload, request: (key: string, payload: TPayload) => Promise<T>): Promise<T> {
    const key = this.keyFor(operation, idempotencyFingerprint(payload));
    const result = await request(key, payload);
    this.complete(operation, key);
    return result;
  }
}

const jsonReplacer = (_key: string, value: unknown): unknown => {
  if (value instanceof File) {
    return {
      name: value.name,
      size: value.size,
      type: value.type,
      lastModified: value.lastModified,
    };
  }
  return value;
};

export const idempotencyFingerprint = (value: unknown): string =>
  JSON.stringify(value, jsonReplacer) ?? String(value);

export const useIdempotencyCheckpoint = (): IdempotencyCheckpoint => {
  const checkpointRef = useRef<IdempotencyCheckpoint>();
  if (!checkpointRef.current) checkpointRef.current = new IdempotencyCheckpoint();
  return checkpointRef.current;
};
