import {useTranslation} from 'react-i18next';
import {Navigate, useLocation} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {AdvisorDashboardOverview} from './AdvisorDashboardOverview';
import {advisorConversationViews, advisorDashboardView, advisorScheduleRequestViews} from './advisorViewModels';
import styles from './AdvisorOperationsPage.module.scss';

export default function AdvisorOperationsPage() {
  const {t: translate} = useTranslation();
  const {user} = useRequiredAuth();
  const {hash, search} = useLocation();
  const dashboard = useQuery({queryKey: ['advisor', 'dashboard'], queryFn: async () => unwrapData(await advisorApiService.getDashboard(), 'advisorDashboard'), retry: false});
  const students = useQuery({queryKey: ['advisor', 'students-highlight'], queryFn: async () => {const pages = await Promise.all((['NEEDS_ATTENTION', 'AT_RISK'] as const).map(risk => advisorApiService.listStudents(0, ADVISOR_PAGE_SIZE, {risk}).then(response => unwrapData(response, 'listAdvisorStudents')))); return {items: [...new Map(pages.flatMap(page => page.items).map(student => [student.studentUserId, student])).values()]};}, retry: false});
  const tasks = useQuery({queryKey: ['advisor', 'action-tasks', 'preview'], queryFn: async () => unwrapData(await advisorApiService.listActionTasks({page: 0, size: ADVISOR_PAGE_SIZE}), 'advisorActionTasks'), retry: false});
  const conversations = useQuery({queryKey: ['advisor', 'conversations', 'preview'], queryFn: async () => unwrapData(await advisorApiService.listConversations(0, ADVISOR_PAGE_SIZE), 'advisorConversations'), retry: false});
  const schedule = useQuery({queryKey: ['advisor', 'schedule-requests', 'preview'], queryFn: async () => unwrapData(await courseOperationsApiService.listAdvisorScheduleRequests({page: 0, size: ADVISOR_PAGE_SIZE}), 'advisorScheduleRequests'), retry: false});
  // Preserve bookmarks from the former stacked dashboard without rendering hidden editors.
  const legacyDestination = hash === '#action-tasks' ? APP_ROUTE_PATHS.advisorTasks : hash === '#schedule-requests' ? APP_ROUTE_PATHS.advisorSchedule : hash === '#conversations' ? APP_ROUTE_PATHS.advisorMessages : null;
  if (legacyDestination) return <Navigate to={`${legacyDestination}${search}`} replace/>;
  const queries = [dashboard, students, tasks, conversations, schedule];
  return <div className={styles.page}>
    <AdvisorDashboardOverview name={user.name || translate('common:roles.ADVISOR')} dashboard={advisorDashboardView(dashboard.data)} students={students.data?.items ?? []}
      tasks={tasks.data?.items ?? []} conversations={advisorConversationViews(conversations.data)} schedule={advisorScheduleRequestViews(schedule.data)}
      loading={queries.some(query => query.isPending)} error={queries.some(query => query.isError)}
      onRetry={() => void Promise.all(queries.filter(query => query.isError).map(query => query.refetch()))}/>
  </div>;
}
