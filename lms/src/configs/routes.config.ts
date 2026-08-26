export interface SidebarConfig {
  name: string;
  path: string;
  sidebarItem: {
    filledIcon: string;
    unfilledIcon: string;
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
  '/my-plan',
  '/settings',
  '/profile',
  '/post',
  '/roster',
  '/create',
];

export const shouldShowAppShell = (pathname: string): boolean => {
  if (pathname === '/') return true;
  return APP_SHELL_BASE_PATHS.some(
    base => base !== '/' && (pathname === base || pathname.startsWith(`${base}/`)),
  );
};
