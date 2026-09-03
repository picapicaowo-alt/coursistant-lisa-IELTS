import { useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrapData } from "@/apis";
import { courseApiService } from "@/apis/services/course-api";
import { courseOperationsApiService as api } from "@/apis/services/course-operations-api";
import { operationKeys, parseOccurrences } from "./records";

export function useCourseOccurrences(
  courseId: number,
  from?: string,
  to?: string,
  includeHistory = true,
) {
  return useQuery({
    queryKey: [
      ...operationKeys.occurrences(courseId),
      { from, to, includeHistory },
    ],
    queryFn: async () =>
      parseOccurrences(
        unwrapData(
          await api.listSessionOccurrences(courseId, {
            from,
            to,
            includeHistory,
          }),
          "class occurrences",
        ),
      ),
    retry: false,
  });
}
export function useCourseWeeks(courseId: number) {
  return useQuery({
    queryKey: operationKeys.weeks(courseId),
    queryFn: async () =>
      unwrapData(
        await courseApiService.getCourseWeeks(courseId),
        "course lectures",
      ),
    retry: false,
  });
}
export function useCourseSessions(courseId: number) {
  return useQuery({
    queryKey: ["course-sessions", courseId],
    queryFn: async () =>
      unwrapData(
        await courseApiService.getCourseSessions(courseId),
        "course sessions",
      ),
    retry: false,
  });
}
export function useRefreshTeaching(courseId: number) {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: operationKeys.course(courseId) }),
      client.invalidateQueries({ queryKey: ["me", "teaching-today"] }),
      client.invalidateQueries({
        queryKey: ["me", "teaching-schedule-requests"],
      }),
      client.invalidateQueries({ queryKey: ["me", "teaching-alerts"] }),
      client.invalidateQueries({ queryKey: ["me", "teaching-support"] }),
      client.invalidateQueries({ queryKey: ["calendar"] }),
    ]);
  };
}
