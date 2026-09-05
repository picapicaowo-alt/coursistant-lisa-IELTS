import { useTranslation } from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {generatePath, Link} from 'react-router-dom';

import {unwrapData} from '@/apis';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {LearningEmpty, LearningQueryState} from '@/components/LearningWorkspace';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {formatGradePoints} from '@/pages/CourseGradesPage/gradeDisplay';
import s from './GradesCard.module.scss';

const GRADE_PREVIEW_LIMIT = 3;
export function GradesCard({courseId}: {courseId: number}) {
  const { t: translate } = useTranslation();
  const query = useQuery({queryKey: ['course-my-grades', courseId], queryFn: async () => unwrapData(await assignmentApiService.listMyGrades(courseId), 'course grades'), retry: false});
  return <WorkspaceSection title={translate("course:grades.label")} appearance="record" meta={<Link className={s.link} to={generatePath(APP_ROUTE_PATHS.courseCourseIdGrades, {courseId: String(courseId)})}>{translate("common:actions.viewAll")}</Link>}>
    <LearningQueryState query={query}/>
    {query.isSuccess && !query.data.length ? <LearningEmpty title={translate("course:learning.noGrades")}/> : null}
    <div className={s.list}>{query.data?.slice(0, GRADE_PREVIEW_LIMIT).map(item => {
      const score = item.pointsEarned ?? item.score;
      return <Link key={item.assignmentId} to={generatePath(APP_ROUTE_PATHS.courseCourseIdAssignmentsAssignmentId, {courseId: String(courseId), assignmentId: String(item.assignmentId)})}><span>{item.assignmentTitle || item.title || translate("course:learning.assignment")}</span><strong data-released={item.released || undefined}>{item.released && score != null ? `${formatGradePoints(score)}${item.pointsPossible != null ? ` / ${formatGradePoints(item.pointsPossible)}` : ''}` : translate(item.released ? "course:learning.scoreUnavailable" : "course:learning.notReleased")}</strong></Link>;
    })}</div>
  </WorkspaceSection>;
}
