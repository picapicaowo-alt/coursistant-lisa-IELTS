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

/** Course summaries use Instructor-prefixed fields; legacy name is display-only fallback. */
export const formatInstructorName = (person: {
  instructorFirstName?: string | null;
  instructorMiddleName?: string | null;
  instructorLastName?: string | null;
  name?: string | null;
} | null | undefined, fallback = ''): string => formatPersonName({
  firstName: person?.instructorFirstName,
  middleName: person?.instructorMiddleName,
  lastName: person?.instructorLastName,
}, person?.name || fallback);
