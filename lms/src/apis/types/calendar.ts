export interface CalendarQuery {
  /** Inclusive display-zone date. */
  from?: string;
  /** Exclusive display-zone date. */
  to?: string;
  timezone?: string;
}

export interface CalendarEvent {
  eventType: string;
  sourceId: number;
  /** Absolute instants; never reinterpret using the source timezone. */
  startsAtUtc: string;
  endsAtUtc?: string | null;
  /** Session source timezone, not the page's display timezone. */
  timezone?: string;
  courseId?: number;
  courseCode?: string;
  courseTitle?: string;
  title?: string;
  occurrenceId?: number;
}

export interface CalendarFeed {
  /** Display timezone used for this query and all item presentation. */
  timezone: string;
  fromUtc: string;
  toUtc: string;
  items: CalendarEvent[];
}
