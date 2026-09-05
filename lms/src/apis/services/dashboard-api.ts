// Dashboard API service — see docs/api/dashboard_module-api_en.md
//
// One method per dashboard region. There is no aggregate endpoint by design:
// each region is fetched independently so one failure cannot blank the page.
// Errors are rethrown rather than swallowed — callers must render an error with
// a retry, never an empty state (PRD PRIN-03).

import {
  ApiResponse,
  GradingQueueItem,
  MyCoursePageResponse,
  MyCoursesParams,
  RecentActivityItem,
  RecentAnnouncement,
  TeachingCourse,
  TeachingDeadline,
  UpcomingActivity,
  UpcomingDeadline,
  V2ApiClient,
} from '@/apis';

/**
 * Server-side defaults and caps, mirrored here so callers can reason about
 * what they will get back. The server clamps out-of-range values rather than
 * rejecting them, so sending a larger number silently yields the cap.
 */
export const DASHBOARD_LIMITS = {
  deadlineDays: {default: 14, max: 30},
  activityDays: {default: 7, max: 30},
  recentLimit: {default: 10, max: 50},
  coursePageSize: {default: 20, max: 100},
} as const;

export class DashboardApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) {
      this.apiClient = apiClient;
    }
  }

  // -------------------------------------------------------------- Student

  /**
   * Courses the caller is actively enrolled in, as a page object.
   *
   * USER accounts only — admin accounts get 403 FORBIDDEN. Sorted by
   * `updatedAt DESC, id DESC`.
   */
  async getMyCourses(params?: MyCoursesParams): Promise<ApiResponse<MyCoursePageResponse>> {
    try {
      return await this.apiClient.get<MyCoursePageResponse>('/v2/me/courses', {params});
    } catch (error) {
      console.error('Failed to get my courses', error);
      throw error;
    }
  }

  /**
   * Assignments due within `days`, filtered on a UTC window.
   * Includes work already submitted but not yet due.
   */
  async getUpcomingDeadlines(
    days: number = DASHBOARD_LIMITS.deadlineDays.default
  ): Promise<ApiResponse<UpcomingDeadline[]>> {
    try {
      return await this.apiClient.get<UpcomingDeadline[]>('/v2/me/assignments/upcoming', {
        params: {days},
      });
    } catch (error) {
      console.error('Failed to get upcoming deadlines', error);
      throw error;
    }
  }

  /**
   * Sessions and course events within `days`, on a tenant calendar-day window.
   * Sessions that already finished today are still included.
   */
  async getUpcomingActivities(
    days: number = DASHBOARD_LIMITS.activityDays.default,
    options?: {source?: 'SESSION' | 'EVENT' | 'Session' | 'Event' | string; limit?: number}
  ): Promise<ApiResponse<UpcomingActivity[]>> {
    try {
      return await this.apiClient.get<UpcomingActivity[]>('/v2/me/events/upcoming', {
        params: {days, ...options},
      });
    } catch (error) {
      console.error('Failed to get upcoming activities', error);
      throw error;
    }
  }

  /** Announcement headers only — the payload carries no body or author. */
  async getRecentAnnouncements(
    limit: number = DASHBOARD_LIMITS.recentLimit.default
  ): Promise<ApiResponse<RecentAnnouncement[]>> {
    try {
      return await this.apiClient.get<RecentAnnouncement[]>('/v2/me/announcements/recent', {
        params: {limit},
      });
    } catch (error) {
      console.error('Failed to get recent announcements', error);
      throw error;
    }
  }

  // ------------------------------------------------------------- Teaching
  //
  // Every endpoint below requires the global user `level` to be INSTRUCTOR and
  // returns 403 ACCESS_DENIED otherwise. Read-only: the dashboard links into
  // grading, it never writes grades.

  /** Non-archived courses the caller teaches, sorted by `courseCode ASC`. */
  async getTeachingCourses(): Promise<ApiResponse<TeachingCourse[]>> {
    try {
      return await this.apiClient.get<TeachingCourse[]>('/v2/me/teaching/courses');
    } catch (error) {
      console.error('Failed to get teaching courses', error);
      throw error;
    }
  }

  /** IELTS excludes legacy Quiz buckets while the shared backend still returns them. */
  async getGradingQueue(): Promise<ApiResponse<GradingQueueItem[]>> {
    try {
      const response = await this.apiClient.get<GradingQueueItem[]>('/v2/me/teaching/grading-queue');
      return {...response, data: response.data?.filter(item => item.kind === 'AssignmentUngraded' || item.kind === 'AssignmentAwaitingRelease') ?? response.data};
    } catch (error) {
      console.error('Failed to get grading queue', error);
      throw error;
    }
  }

  /**
   * Teaching-side activities. Unlike the student endpoint, sessions are clipped
   * to the course term dates.
   */
  async getTeachingActivities(
    days: number = DASHBOARD_LIMITS.activityDays.default
  ): Promise<ApiResponse<UpcomingActivity[]>> {
    try {
      return await this.apiClient.get<UpcomingActivity[]>('/v2/me/teaching/activities/upcoming', {
        params: {days},
      });
    } catch (error) {
      console.error('Failed to get teaching activities', error);
      throw error;
    }
  }

  /** IELTS assignment deadlines with submission progress. */
  async getTeachingDeadlines(
    days: number = DASHBOARD_LIMITS.deadlineDays.default
  ): Promise<ApiResponse<TeachingDeadline[]>> {
    try {
      const response = await this.apiClient.get<TeachingDeadline[]>('/v2/me/teaching/deadlines/upcoming', {
        params: {days},
      });
      return {...response, data: response.data?.filter(item => item.kind === 'Assignment') ?? response.data};
    } catch (error) {
      console.error('Failed to get teaching deadlines', error);
      throw error;
    }
  }

  /** Group membership changes and late submissions, most recent first. */
  async getRecentActivity(
    limit: number = DASHBOARD_LIMITS.recentLimit.default
  ): Promise<ApiResponse<RecentActivityItem[]>> {
    try {
      return await this.apiClient.get<RecentActivityItem[]>('/v2/me/teaching/activity/recent', {
        params: {limit},
      });
    } catch (error) {
      console.error('Failed to get recent activity', error);
      throw error;
    }
  }
}

export const dashboardApiService = new DashboardApiService();
