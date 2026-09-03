import { WorkspaceSection } from "@/components/WorkspaceSection";
import { RecordSummaryList } from "@/components/RecordSummaryList";
import { useQueries } from "@tanstack/react-query";
import { unwrapData } from "@/apis";
import { parentApiService } from "@/apis/services/parent-api";
import { advisingErrorMessage } from "../advising/advisingErrors";
import styles from "./index.module.scss";
import advisingStyles from "../advising/advising.module.scss";
import {type ParentLearningTab} from '@/configs/parentNavigation';
import {ParentCourseList} from './ParentCourseList';
import {ParentStudyPlan} from './ParentStudyPlan';
import {ParentLearningProfile} from './ParentLearningProfile';

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
  studentUserId,
  tab,
}: {
  studentUserId: number;
  tab: ParentLearningTab;
}) {
  const visibleKeys = tab === 'plan' ? ['studyPlan', 'profile', 'risk'] : tab === 'courses' ? ['courses', 'assignments'] : ['attendance', 'hours'];
  const sections = visibleKeys.flatMap(key => LEARNING_SECTIONS.filter(section => section.key === key));
  // Independent reads preserve the other academic sections if one service fails.
  const results = useQueries({
    queries: sections.map((section) => ({
          queryKey: ["parent", studentUserId, "learning", section.key],
          queryFn: async () =>
            unwrapData(
              await section.load(studentUserId),
              `parent-${section.key}`,
            ),
          retry: false,
        })),
  });
  const resultFor = (key: typeof LEARNING_SECTIONS[number]['key']) => results[sections.findIndex(section => section.key === key)];
  const renderError = (title: string, result: typeof results[number]) => <div role="alert" className={advisingStyles.conflictNotice}>
    <p>{advisingErrorMessage(result.error, `${title} could not be loaded.`)}</p>
    <button className={advisingStyles.secondary} type="button" onClick={() => void result.refetch()}>Retry</button>
  </div>;

  if (tab === 'plan') {
    const studyPlan = resultFor('studyPlan');
    const profile = resultFor('profile');
    const risk = resultFor('risk');
    return <div className={styles.learningGrid}>
      <WorkspaceSection title="Study plan" className={styles.studyPlan}>
        {studyPlan.isPending ? <p role="status">Loading study plan…</p> : studyPlan.isError ? renderError('Study plan', studyPlan) : <ParentStudyPlan value={studyPlan.data}/>}
      </WorkspaceSection>
      <WorkspaceSection title="Learning profile" className={styles.learningProfile}>
        {profile.isPending ? <p role="status">Loading learning profile…</p> : profile.isError ? renderError('Learning profile', profile) : <ParentLearningProfile value={profile.data} risk={risk.data}/>}
        {risk.isPending ? <p role="status" className={styles.meta}>Loading learning status…</p> : risk.isError ? renderError('Learning status', risk) : null}
      </WorkspaceSection>
    </div>;
  }
  return (
    <div className={styles.learningGrid}>
      {sections.map(({ key, title }, index) => {
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
            ) : key === 'courses' ? <ParentCourseList value={result.data}/> : (
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
