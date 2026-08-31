export interface PersonNameParts {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}

/** Formats the split-name fields used by the current registration contracts. */
export const formatPersonName = (
  person: PersonNameParts | null | undefined,
  fallback = '',
): string => {
  if (!person) return fallback;

  const formatted = [person.firstName, person.middleName, person.lastName]
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');

  return formatted || fallback;
};
