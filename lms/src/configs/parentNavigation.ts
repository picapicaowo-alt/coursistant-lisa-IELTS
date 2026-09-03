import {APP_ROUTE_PATHS} from './routePaths';

/** One owner for Parent navigation, including existing bookmarked section URLs. */
export const PARENT_SECTIONS = {
  dashboard: {label: 'Student progress', description: 'A clear view of learning, attendance and course progress.'},
  learning: {label: 'Learning', description: 'Explore the study plan, coursework and learning record.'},
  schedule: {label: 'Schedule', description: 'Review scheduled classes and follow up on change requests.'},
  reports: {label: 'Reports', description: 'Read published learning reports and the advising team’s recommendations.'},
  exams: {label: 'Mock exams', description: 'Review assigned exams, completed sections and published scores.'},
  messages: {label: 'Messages', description: 'Stay in touch with the advising team and read academic updates.'},
  notifications: {label: 'Messages', description: 'Stay in touch with the advising team and read academic updates.'},
} as const;

export type ParentSection = keyof typeof PARENT_SECTIONS;
export type ParentArea = Exclude<ParentSection, 'notifications'>;
export const PARENT_AREAS: ParentArea[] = ['dashboard', 'learning', 'schedule', 'reports', 'exams', 'messages'];
export const PARENT_LEARNING_TABS = [
  {id: 'plan', label: 'Study plan'},
  {id: 'courses', label: 'Courses & assignments'},
  {id: 'attendance', label: 'Attendance & hours'},
] as const;
export const PARENT_SCHEDULE_TABS = [
  {id: 'upcoming', label: 'Scheduled classes'},
  {id: 'requests', label: 'Request history'},
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
