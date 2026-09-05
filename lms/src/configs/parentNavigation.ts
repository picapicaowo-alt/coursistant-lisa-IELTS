import {APP_ROUTE_PATHS} from './routePaths';

/** One owner for Parent navigation, including existing bookmarked section URLs. */
export const PARENT_SECTIONS = {
  dashboard: {label: "navigation:studentProgress", description: "navigation:parent.progressDescription"},
  learning: {label: "navigation:parent.learning", description: "navigation:parent.learningDescription"},
  schedule: {label: "navigation:parent.schedule", description: "navigation:parent.scheduleDescription"},
  reports: {label: "navigation:parent.reports", description: "navigation:parent.reportsDescription"},
  exams: {label: "navigation:mockExams", description: "navigation:parent.examsDescription"},
  messages: {label: "navigation:messages", description: "navigation:parent.messagesDescription"},
  notifications: {label: "navigation:messages", description: "navigation:parent.messagesDescription"},
} as const;

export type ParentSection = keyof typeof PARENT_SECTIONS;
export type ParentArea = Exclude<ParentSection, 'notifications'>;
export const PARENT_AREAS: ParentArea[] = ['dashboard', 'learning', 'schedule', 'reports', 'exams', 'messages'];
export const PARENT_LEARNING_TABS = [
  {id: 'plan', label: "navigation:parent.studyPlan"},
  {id: 'courses', label: "navigation:parent.coursework"},
  {id: 'attendance', label: "navigation:parent.attendance"},
] as const;
export const PARENT_SCHEDULE_TABS = [
  {id: 'upcoming', label: "navigation:parent.scheduledClasses"},
  {id: 'requests', label: "navigation:parent.requestHistory"},
] as const;
export type ParentLearningTab = typeof PARENT_LEARNING_TABS[number]['id'];

export function getParentSection(params: URLSearchParams): ParentSection {
  const section = params.get('section');
  return section && Object.prototype.hasOwnProperty.call(PARENT_SECTIONS, section) ? section as ParentSection : 'dashboard';
}

export function getParentArea(section: ParentSection): ParentArea {
  return section === 'notifications' ? 'messages' : section;
}

export function parentHref(section: ParentSection, current: URLSearchParams, tab?: string): string {
  const params = new URLSearchParams();
  params.set('section', section);
  const student = current.get('studentUserId');
  if (student) params.set('studentUserId', student);
  if (tab) params.set('tab', tab);
  return `${APP_ROUTE_PATHS.parent}?${params}`;
}
