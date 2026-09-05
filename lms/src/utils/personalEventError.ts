import {getApiErrorCode} from './apiError';

export const isPersonalEventVersionConflict = (error: unknown): boolean =>
  getApiErrorCode(error) === 'PERSONAL_EVENT_VERSION_CONFLICT';

/** Keep contract diagnostics available while rendering locale-reactive UI copy. */
export function personalEventErrorKey(error: unknown, deleting: boolean): string {
  switch (getApiErrorCode(error)) {
    case 'PERSONAL_EVENT_VERSION_CONFLICT': return 'calendar:editor.versionConflict';
    case 'PARAM_MISSING': return deleting ? 'calendar:editor.requestVersionMissing' : 'calendar:editor.saveFailed';
    case 'BAD_REQUEST': return deleting ? 'calendar:editor.requestVersionInvalid' : 'calendar:editor.saveFailed';
    default: return deleting ? 'calendar:editor.deleteFailed' : 'calendar:editor.saveFailed';
  }
}
