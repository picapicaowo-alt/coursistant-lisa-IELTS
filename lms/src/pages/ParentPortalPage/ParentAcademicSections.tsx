import { WorkspaceSection } from "@/components/WorkspaceSection";
import { RecordSummaryList } from "@/components/RecordSummaryList";
import { useQueries } from "@tanstack/react-query";
import { unwrapData } from "@/apis";
import { parentApiService } from "@/apis/services/parent-api";
import { advisingErrorMessage } from "../advising/advisingErrors";
import styles from "./index.module.scss";
import advisingStyles from "../advising/advising.module.scss";

const LEARNING_SECTIONS = [
  {
    key: "profile",
    title: "Learning profile",
    load: (id: number) => parentApiService.getStudentProfile(id),
  },
  {
    key: "studyPlan",
    title: "Study plan",
    load: (id: number) => parentApiService.getStudentStudyPlan(id),
  },
  {
    key: "courses",
    title: "Courses",
    load: (id: number) => parentApiService.listStudentCourses(id),
  },
  {
    key: "assignments",
    title: "Assignments",
    load: (id: number) => parentApiService.listStudentAssignments(id),
  },
  {
    key: "attendance",
    title: "Attendance",
    load: (id: number) => parentApiService.listStudentAttendance(id),
  },
  {
    key: "hours",
    title: "Course hours",
    load: (id: number) => parentApiService.getStudentHours(id),
  },
  {
    key: "risk",
    title: "Learning status",
    load: (id: number) => parentApiService.getStudentRisk(id),
  },
] as const;

export function ParentAcademicSections({
  value,
  learning,
  studentUserId,
}: {
  value: unknown;
  learning: boolean;
  studentUserId: number;
}) {
  // Independent reads preserve the other academic sections if one service fails.
  const results = useQueries({
    queries: learning
      ? LEARNING_SECTIONS.map((section) => ({
          queryKey: ["parent", studentUserId, "learning", section.key],
          queryFn: async () =>
            unwrapData(
              await section.load(studentUserId),
              `parent-${section.key}`,
            ),
          retry: false,
        }))
      : [],
  });
  if (!learning)
    return (
      <WorkspaceSection title="Academic overview">
        <RecordSummaryList
          value={value}
          emptyMessage="No academic updates are available yet."
        />
      </WorkspaceSection>
    );
  return (
    <div className={styles.learningGrid}>
      {LEARNING_SECTIONS.map(({ key, title }, index) => {
        const result = results[index];
        return (
          <WorkspaceSection key={key} title={title} className={styles[key]}>
            {result.isPending ? (
              <p role="status">Loading {title.toLowerCase()}…</p>
            ) : result.isError ? (
              <div role="alert" className={advisingStyles.conflictNotice}>
                <p>
                  {advisingErrorMessage(
                    result.error,
                    `${title} could not be loaded.`,
                  )}
                </p>
                <button className={advisingStyles.secondary} type="button" onClick={() => void result.refetch()}>
                  Retry
                </button>
              </div>
            ) : (
              <RecordSummaryList
                value={result.data}
                emptyMessage="No updates are available yet."
              />
            )}
          </WorkspaceSection>
        );
      })}
    </div>
  );
}
