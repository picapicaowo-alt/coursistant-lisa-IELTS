import {useQuery} from '@tanstack/react-query';
import {Link, generatePath} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {unwrapData} from '@/apis';
import type {AdvisorActionTaskResponse} from '@/apis/types/advising';
import {advisorApiService} from '@/apis/services/advisor-api';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {formatDateValue, formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import {advisingQueryKeys} from '../advising/queryKeys';
import {formatPersonName} from '@/utils/personName';
import {actionTaskResourceId, actionTaskStudentId} from './taskIdentity';
import styles from './AdvisorTasksPage.module.scss';

export function ActionTaskContext({task}: {task: AdvisorActionTaskResponse}) {
  const {t} = useTranslation();
  const studentId = actionTaskStudentId(task);
  // Shared with the student workspace: repeated reminders for one student reuse one request.
  const student = useQuery({
    queryKey: ['advisor', 'student-hub', studentId],
    meta: {advisingStudentId: studentId},
    queryFn: async () => unwrapData(await advisorApiService.getStudentHub(studentId!), 'advisorStudentHub'),
    enabled: studentId != null,
    retry: false,
  });
  const resourceId = actionTaskResourceId(task);
  const resource = task.target?.resourceType;
  const isPlanResource = resource === 'ADVISOR_TASK' || resource === 'STUDY_PLAN_CHECKPOINT';
  const plan = useQuery({
    queryKey: advisingQueryKeys.advisorStudyPlan(studentId ?? 0),
    meta: {advisingStudentId: studentId},
    queryFn: async () => unwrapData(await advisorApiService.getStudyPlan(studentId!), 'advisorStudyPlan'),
    enabled: studentId != null && isPlanResource,
    retry: false,
  });
  const checkpoints = plan.data?.plan.checkpoints ?? [];
  const sourceTask = resource === 'ADVISOR_TASK' ? checkpoints.flatMap(checkpoint => checkpoint.tasks ?? []).find(item => item.id === task.target?.advisorTaskId) : undefined;
  const checkpoint = resource === 'STUDY_PLAN_CHECKPOINT' ? checkpoints.find(item => item.id === task.target?.checkpointId) : undefined;
  const title = sourceTask?.title || checkpoint?.description || checkpoint?.goal;
  const dueDate = sourceTask?.dueDate || checkpoint?.dueDate;
  const name = formatPersonName(student.data, t('common:people.studentFallback', {id: formatNumber(studentId ?? 0)}));

  return <div className={styles.context}>
    {studentId ? <div className={styles.studentLinks}>
      <Link to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserId, {studentUserId: String(studentId)})}>{name}</Link>
      <Link to={`${APP_ROUTE_PATHS.advisorMessages}?${new URLSearchParams({studentUserId: String(studentId)})}`}>{t('advising:actionTasks.messageStudent')}</Link>
      {student.isError ? <button type="button" onClick={() => void student.refetch()}>{t('advising:actionTasks.retryStudent')}</button> : null}
    </div> : <p>{t('advising:actionTasks.studentUnavailable')}</p>}
    {resource ? <p>{t(`advising:actionTasks.resources.${resource}`)}{resourceId ? ` · ${t('advising:actionTasks.recordId', {id: formatNumber(resourceId)})}` : ''}</p> : null}
    {title ? <p>{title}</p> : null}
    {dueDate ? <p>{t('advising:actionTasks.sourceDueDate', {date: formatDateValue(dueDate)})}</p> : null}
    {sourceTask?.status ? <p>{t('advising:actionTasks.sourceStatus', {status: statusLabel(sourceTask.status)})}</p> : null}
    {plan.isError ? <p>{t('advising:actionTasks.sourceUnavailable')} <button type="button" onClick={() => void plan.refetch()}>{t('common:actions.tryAgain')}</button></p> : null}
  </div>;
}
