export type CourseBadgeTone = 'brand' | 'success' | 'info' | 'warning' | 'neutral';

export interface CourseBadge {
  label: string;
  tone?: CourseBadgeTone;
}

/** Launch / lifecycle strings from the advising contract mapped to a chip colour. Unknown values stay neutral. */
export const courseStatusTone = (status?: string | null): CourseBadgeTone => {
  switch ((status ?? '').toUpperCase()) {
    case 'PUBLISHED':
    case 'ACTIVE':
    case 'ONGOING':
      return 'success';
    case 'READY':
    case 'UPCOMING':
      return 'info';
    case 'WITHDRAWN':
    case 'ARCHIVED':
    case 'HIDDEN':
      return 'warning';
    default:
      return 'neutral';
  }
};

/** Two-letter mark for the identity tile: the course code first, then the title. */
export const courseMark = (code: string | null | undefined, title: string): string => {
  const source = (code || title).replace(/[^\p{L}\p{N}]/gu, '');
  return (source.slice(0, 2) || '#').toUpperCase();
};
