import {formatCourseInstructor} from '@/utils/personName';
import React from "react";
import {useCourseWorkspaceStore} from "../stores/useCourseWorkspaceStore";
import {CourseDetailDTO, CourseResponse, CourseWeek} from "@/apis";
import {useCourseWorkspaceData} from "./useCourseWorkspaceData";

/**
 * Mirrors the loaded course into the workspace store, which edit mode and the
 * header read from.
 *
 * Fetching lives in useCourseWorkspaceData, so both modes share one set of
 * queries. This used to run its own useSuspenseQuery, which had two problems:
 * it fetched the same course twice, and a suspense query reports failure by
 * throwing — so a single failed request took down the whole page instead of
 * letting the view render its own error.
 *
 * Assignments are not loaded. In this API they belong to the course and are
 * ordered by due date, with no reference to a week, while the store models
 * them as children of one. Inventing that link would misfile every assignment
 * (open-decisions.md S-7).
 */
const toCourseDetail = (course: CourseResponse, weeks: CourseWeek[]): CourseDetailDTO => ({
  courseInfo: {
    id: course.id ?? course.courseId,
    courseCode: course.courseCode,
    name: course.title ?? course.name,
    description: course.description ?? "",
    termStartDate: course.termStartDate,
    termEndDate: course.termEndDate,
    location: course.location,
    teacherName: formatCourseInstructor(course.primaryInstructor),
    teacherEmail: course.primaryInstructor?.email,
    createdAt: new Date(course.createdAt),
    updatedAt: new Date(course.updatedAt),
  },
  // Weeks are this product's course units. `orderPosition` is zero-based and
  // ascending, which is what sortOrder means here.
  courseUnits: weeks.map((week) => ({
    id: week.id,
    title: week.title,
    sortOrder: week.orderPosition,
    // Weeks carry materials, not a description.
    description: "",
    createdAt: new Date(week.createdAt),
    updatedAt: new Date(week.updatedAt),
  })),
  assignments: [],
});

export const useCourseEdit = () => {
  // Subscribe only to the action. Subscribing to the full store causes this
  // hook to render again because of its own loadCourseInfo write.
  const loadCourseInfo = useCourseWorkspaceStore(state => state.loadCourseInfo);
  const {course, weeks} = useCourseWorkspaceData();

  React.useEffect(() => {
    if (course) {
      loadCourseInfo(toCourseDetail(course, weeks));
    }
  }, [course, weeks, loadCourseInfo]);
};
