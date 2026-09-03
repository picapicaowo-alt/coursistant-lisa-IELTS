/**
 * The unified response envelope — see docs/api/auth_module-api_en.md 1.4.
 *
 * Success and failure share this shape, so `status` is what you branch on;
 * `code` is a string enum (`"SUCCESS"`, `"INVALID_CREDENTIALS"`, …), not a
 * number. The backend always includes `data`; operations with no payload use
 * an explicit `null` value.
 */
export interface ApiResponse<T = unknown> {
  /** HTTP status, mirrored into the body. */
  status: number;
  code: string;
  data: T | null;
  message: string;
  /** ISO-8601 instant, e.g. "2026-07-25T01:00:00Z". */
  timestamp: string;
}

export interface ApiError {
  code: number;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Headers for a write that requires an `Idempotency-Key`.
 *
 * Only some writes need one — the module docs list them per endpoint. A new
 * key means a new operation, so call this once per user action and reuse the
 * result if you retry that same action after a timeout. Reusing a key with a
 * different payload is rejected with 409 IDEMPOTENCY_KEY_MISMATCH, and
 * generating a fresh key on retry can double-apply the write.
 */
export function idempotent(key: string = crypto.randomUUID()): {headers: Record<string, string>} {
  return {headers: {'Idempotency-Key': key}};
}

/**
 * Reads `data` off a response, failing loudly when it is null (or a malformed
 * runtime response omits it).
 *
 * A 2xx envelope with no `data` where the caller needs one means the contract
 * was broken, and the one thing we must not do is pass the absence downstream
 * as an empty result — a missing list is not an empty list, and rendering it
 * as "nothing here" is the false state PRIN-03 forbids. Throwing puts the
 * caller's error branch in charge instead.
 */
export function unwrapData<T>(response: ApiResponse<T>, context: string): T {
  if (response.data == null) {
    throw new Error(
      `${context}: response had no data (status ${response.status}, code ${response.code})`
    );
  }
  return response.data;
}

/** Reject a mismatched deployment's array response without crashing the page or
 * presenting it as a successful empty queue. */
export function unwrapPageData<T>(response: ApiResponse<{items: T[]; page: number; size: number; total: number}>, context: string) {
  const data = unwrapData(response, context);
  if (!data || !Array.isArray(data.items) || !Number.isInteger(data.page) || !Number.isInteger(data.size) || !Number.isFinite(data.total)) {
    throw new Error('This list returned an unsupported response. Please refresh after the service update.');
  }
  return data;
}

export function unwrapCursorData<T>(response: ApiResponse<{items: T[]; nextBeforeId?: number | null; hasMore: boolean}>, context: string) {
  const data = unwrapData(response, context);
  if (!data || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean' || (data.hasMore && typeof data.nextBeforeId !== 'number')) {
    throw new Error('Messages returned an unsupported response. Please refresh after the service update.');
  }
  return data;
}
