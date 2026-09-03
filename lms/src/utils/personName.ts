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

/** Course instructor projections use role-prefixed structured name fields. */
export function formatCourseInstructor(instructor?: {instructorFirstName?: string; instructorMiddleName?: string; instructorLastName?: string} | null): string {
  return formatPersonName({firstName: instructor?.instructorFirstName, middleName: instructor?.instructorMiddleName, lastName: instructor?.instructorLastName}, '');
}
