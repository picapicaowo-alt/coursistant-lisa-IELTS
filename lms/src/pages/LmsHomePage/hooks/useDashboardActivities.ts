import {useQuery} from '@tanstack/react-query';
import {dashboardApiService, DASHBOARD_LIMITS} from '@/apis/services/dashboard-api';
import {UpcomingActivity} from '@/apis';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {isInstructorLevel} from '@/utils/roleCapabilities';

/**
 * How far ahead the schedule widget loads.
 *
 * The endpoint caps at 30 days and only ever looks forward, so this is as much
 * as the calendar can ever know about. Anything outside it is unknown rather
 * than empty, which is why the widget has to say so instead of drawing a blank
 * month (PRIN-03).
 */
export const ACTIVITY_WINDOW_DAYS = DASHBOARD_LIMITS.activityDays.max;

export interface DashboardActivitiesResult {
  activities: UpcomingActivity[];
  /** Tenant-local `YYYY-MM-DD` bounds the data actually covers, inclusive. */
  coveredFrom: string;
  coveredTo: string;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const toDateKey = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * Sessions and course events for the Learning Schedule widget.
 *
 * Teaching staff hit their own endpoint — the student one would only return
 * courses they are enrolled in, and the teaching variant additionally clips
 * sessions to the course term dates.
 *
 * The window is counted in tenant calendar days, not UTC, so it can differ by
 * a day from the deadlines widget. That inconsistency lives in the API.
 */
export const useDashboardActivities = (): DashboardActivitiesResult => {
  const {user} = useRequiredAuth();
  const isInstructor = isInstructorLevel(user);

  const query = useQuery({
    queryKey: ['dashboard', 'activities', user.id, isInstructor],
    queryFn: async (): Promise<UpcomingActivity[]> => {
      const response = isInstructor
        ? await dashboardApiService.getTeachingActivities(ACTIVITY_WINDOW_DAYS)
        : await dashboardApiService.getUpcomingActivities(ACTIVITY_WINDOW_DAYS);

      if (!response.data) {
        throw new Error('Malformed response from the activities endpoint');
      }
      return [...response.data].sort((a, b) => {
        const aKey = a.startsAtUtc || `${a.date}T${a.startTime}`;
        const bKey = b.startsAtUtc || `${b.date}T${b.startTime}`;
        return aKey.localeCompare(bKey);
      });
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const today = new Date();
  const last = new Date(today);
  last.setDate(last.getDate() + ACTIVITY_WINDOW_DAYS - 1);

  return {
    activities: query.data ?? [],
    coveredFrom: toDateKey(today),
    coveredTo: toDateKey(last),
    isLoading: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
};
