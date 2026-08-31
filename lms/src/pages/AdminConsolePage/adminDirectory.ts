import type {ManagedUser} from '@/apis';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const userItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.content)) return value.content;
  return [];
};

export const normalizeManagedUser = (value: unknown): ManagedUser | null => {
  if (!isRecord(value)) return null;
  return Number.isInteger(value.id)
    && Number.isInteger(value.tenantId)
    && typeof value.email === 'string'
    && typeof value.role === 'string'
    && typeof value.level === 'string'
    && (value.status === 'ACTIVE' || value.status === 'DISABLED')
    ? value as unknown as ManagedUser
    : null;
};

/** Narrows the generic tenant-directory envelope without trusting malformed rows. */
export const normalizeManagedUsers = (value: unknown): ManagedUser[] =>
  userItems(value).map(normalizeManagedUser).filter((item): item is ManagedUser => item !== null);
