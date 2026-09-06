import { useTranslation } from 'react-i18next';
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
import {ParentAssignments} from './ParentAssignments';
import {ParentLearningProfile} from './ParentLearningProfile';

const LEARNING_SECTIONS = [
  {
    key: "profile",
    titleKey: "learning:parent.profile",
    load: (id: number) => parentApiService.getStudentProfile(id),
  },
  {
    key: "studyPlan",
    titleKey: "navigation:parent.studyPlan",
    load: (id: number) => parentApiService.getStudentStudyPlan(id),
  },
  {
    key: "courses",
    titleKey: "common:fields.courses",
    load: (id: number) => parentApiService.listStudentCourses(id),
  },
  {
    key: "assignments",
    titleKey: "course:detail.assignments",
    load: (id: number) => parentApiService.listStudentAssignments(id),
  },
  {
    key: "attendance",
    titleKey: "operations:tabs.attendance",
    load: (id: number) => parentApiService.listStudentAttendance(id),
  },
  {
    key: "hours",
    titleKey: "learning:hours.title",
    load: (id: number) => parentApiService.getStudentHours(id),
  },
  {
    key: "risk",
    titleKey: "learning:parent.learningStatus",
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
  const { t: translate } = useTranslation();
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
    <p>{advisingErrorMessage(result.error, translate('learning:parent.sectionFailed', {section: title}))}</p>
    <button className={advisingStyles.secondary} type="button" onClick={() => void result.refetch()}>{translate("common:actions.retry")}</button>
  </div>;

  if (tab === 'plan') {
    const studyPlan = resultFor('studyPlan');
    const profile = resultFor('profile');
    const risk = resultFor('risk');
    return <div className={styles.learningGrid}>
      <WorkspaceSection title={translate("navigation:parent.studyPlan")} className={styles.studyPlan}>
        {studyPlan.isPending ? <p role="status">{translate("learning:parent.loadingPlan")}</p> : studyPlan.isError ? renderError(translate("navigation:parent.studyPlan"), studyPlan) : <ParentStudyPlan value={studyPlan.data}/>}
      </WorkspaceSection>
      <WorkspaceSection title={translate("learning:parent.profile")} className={styles.learningProfile}>
        {profile.isPending ? <p role="status">{translate("learning:parent.loadingProfile")}</p> : profile.isError ? renderError(translate("learning:parent.profile"), profile) : <ParentLearningProfile value={profile.data} risk={risk.data}/>}
        {risk.isPending ? <p role="status" className={styles.meta}>{translate("learning:parent.loadingStatus")}</p> : risk.isError ? renderError(translate("learning:parent.learningStatus"), risk) : null}
      </WorkspaceSection>
    </div>;
  }
  return (
    <div className={styles.learningGrid}>
      {sections.map(({ key, titleKey }, index) => {
        const result = results[index];
        const title = translate(titleKey);
        return (
          <WorkspaceSection key={key} title={title} className={styles[key]}>
            {result.isPending ? (
              <p role="status">{translate('learning:parent.loadingSection', {section: title})}</p>
            ) : result.isError ? (
              <div role="alert" className={advisingStyles.conflictNotice}>
                <p>
                  {advisingErrorMessage(
                    result.error,
                    translate('learning:parent.sectionFailed', {section: title}),
                  )}
                </p>
                <button className={advisingStyles.secondary} type="button" onClick={() => void result.refetch()}>
                  {translate("common:actions.retry")}</button>
              </div>
            ) : key === 'courses' ? <ParentCourseList value={result.data}/> : key === 'assignments' ? <ParentAssignments value={result.data}/> : (
              <RecordSummaryList
                value={result.data}
                emptyMessage={translate("learning:parent.noUpdates")}
              />
            )}
          </WorkspaceSection>
        );
      })}
    </div>
  );
}
