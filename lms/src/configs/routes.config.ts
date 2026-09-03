import {APP_ROUTE_PATHS, STUDY_PLAN_QUERY_PARAMS} from './routePaths';
import {VOCABULARY_PATHS, isVocabularySessionPath} from '@/pages/vocabulary/routes';

export interface SidebarConfig {
  name: string;
  path: string;
  sidebarItem: {
    filledIcon?: string;
    unfilledIcon?: string;
    icon?: 'vocabulary';
    translationLabel: string;
  };
}

export const SIDEBAR_CONFIGS: SidebarConfig[] = [
  {
    name: "Dashboard",
    path: "/",
    sidebarItem: {
      filledIcon: "/icons/home_fill.png",
      unfilledIcon: "/icons/home_unfill.png",
      translationLabel: "sidebar.dashboard",
    },
  },
  {
    name: "My Course",
    path: "/course",
    sidebarItem: {
      filledIcon: "/icons/course_fill.png",
      unfilledIcon: "/icons/course_unfill.png",
      translationLabel: "sidebar.myCourse",
    },
  },
  {
    name: "Calendar",
    path: "/calendar",
    sidebarItem: {
      filledIcon: "/icons/calendar_fill.svg",
      unfilledIcon: "/icons/calendar_unfill.svg",
      translationLabel: "sidebar.calendar",
    },
  },
  {
    name: "Vocabulary",
    path: VOCABULARY_PATHS.root,
    sidebarItem: {
      icon: "vocabulary",
      translationLabel: "sidebar.vocabulary",
    },
  },
  {
    name: "AI Workplace",
    path: "/aibot",
    sidebarItem: {
      filledIcon: "/icons/ai_course.png",
      unfilledIcon: "/icons/ai_course.png",
      translationLabel: "sidebar.aiWorkplace",
    },
  }
];

export const getSidebarIndex = (pathname: string): number =>
  SIDEBAR_CONFIGS.findIndex(({path}) =>
    path === "/"
      ? pathname === "/"
      : pathname === path || pathname.startsWith(`${path}/`),
  );

const APP_SHELL_BASE_PATHS = [
  '/',
  '/course',
  '/calendar',
  '/aibot',
  '/admin',
  '/counsellor',
  '/advisor',
  '/parent',
  '/mock-exams',
  '/my-plan',
  '/my-operations',
  VOCABULARY_PATHS.root,
  '/settings',
  '/profile',
  '/post',
  '/roster',
  '/create',
];

export const shouldShowAppShell = (pathname: string, search = ''): boolean => {
  // Figma's focused checkpoint view has its own Back navigation. This is only
  // presentation; the existing Student route guard still owns authorization.
  if (pathname === APP_ROUTE_PATHS.myPlan && new URLSearchParams(search).get(STUDY_PLAN_QUERY_PARAMS.checkpoint)) return false;
  if (isVocabularySessionPath(pathname)) return false;
  if (pathname === '/') return true;
  return APP_SHELL_BASE_PATHS.some(
    base => base !== '/' && (pathname === base || pathname.startsWith(`${base}/`)),
  );
};
