import React from 'react';
import {Link, useLocation} from 'react-router-dom';
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {getSidebarIndex, SIDEBAR_CONFIGS} from '@/configs/routes.config';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {
  getSignedInHomePath,
} from '@/utils/signedInHomePath';
import {
  canAccessAdminConsole,
  canAccessAiWorkspace,
  canAccessCalendar,
  canAccessCourseCatalogue,
  canAccessDashboard,
  canAccessStandaloneMockExams,
  isAdvisorAccount,
  isCounsellorAccount,
  isInstructorLevel,
  isParentAccount,
  isPureAdvisor,
  isStudentAccount,
  isTenantAdminAccount,
} from '@/utils/roleCapabilities';
import {VOCABULARY_PATHS} from '@/pages/vocabulary/routes';
import styles from './Sidebar.module.scss';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {getParentArea, getParentSection, parentHref, PARENT_AREAS, PARENT_SECTIONS, type ParentArea} from '@/configs/parentNavigation';

const PARENT_ICONS: Record<ParentArea, LucideIcon> = {
  dashboard: ChartNoAxesCombined, learning: BookOpen, schedule: CalendarDays,
  reports: ClipboardList, exams: GraduationCap, messages: MessageSquare,
};

interface NavigationItemProps {
  to: string;
  label: string;
  active: boolean;
  icon?: LucideIcon;
  asset?: string;
  onNavigate?: () => void;
}

const NavigationItem = ({to, label, active, icon: Icon, asset, onNavigate}: NavigationItemProps) => (
  <li>
    <Link to={to} onClick={onNavigate} className={styles.navigationItem} aria-label={label} title={label} data-active={active || undefined} aria-current={active ? 'page' : undefined}>
      {asset ? <img className={styles.navigationAsset} src={asset} alt=""/> : Icon ? <Icon className={styles.navigationIcon} size={21} strokeWidth={1.8} aria-hidden="true"/> : null}
      <span>{label}</span>
    </Link>
  </li>
);

const STANDARD_ICONS: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/course': BookOpen,
  '/calendar': CalendarDays,
  [VOCABULARY_PATHS.root]: BookMarked,
  '/aibot': Sparkles,
};

const Sidebar: React.FC = () => {
  const {t} = useTranslation();
  const {user} = useRequiredAuth();
  const {pathname, hash, search} = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);
  const [isMoreOpen, setIsMoreOpen] = React.useState(false);
  const selectedSidebarIndex = getSidebarIndex(pathname);
  const isUserAccount = user.role === 'USER';
  const counsellor = isCounsellorAccount(user);
  const advisor = isAdvisorAccount(user);
  const advisorOnly = isPureAdvisor(user);
  const student = isStudentAccount(user);
  const instructor = isInstructorLevel(user);
  const parent = isParentAccount(user);
  const canUseAdminConsole = canAccessAdminConsole(user);
  const homePath = advisor ? APP_ROUTE_PATHS.advisorOperations : getSignedInHomePath(user);
  const standardItems = SIDEBAR_CONFIGS
    .map((item, originalIndex) => ({item, originalIndex}))
    .filter(({item}) => {
      if (counsellor || advisorOnly || parent) return false;
      if (item.path === '/') return !advisor && canAccessDashboard(user);
      if (item.path === '/course') return canAccessCourseCatalogue(user);
      if (item.path === '/calendar') return canAccessCalendar(user);
      if (item.path === VOCABULARY_PATHS.root) return student;
      if (item.path === '/aibot') return canAccessAiWorkspace(user);
      return false;
    });

  const navigationItems: NavigationItemProps[] = [];
  const addItem = (item: NavigationItemProps) => navigationItems.push(item);

  if (student) {
    addItem({to: APP_ROUTE_PATHS.home, label: t('navigation:dashboard'), asset: '/icons/figma-dashboard/home.svg', active: pathname === '/'});
    addItem({to: APP_ROUTE_PATHS.course, label: t('navigation:myCourses'), asset: '/icons/figma-dashboard/courses.svg', active: pathname.startsWith('/course')});
    addItem({to: APP_ROUTE_PATHS.myPlan, label: t('navigation:studyPlan'), asset: '/icons/figma-dashboard/study-plan.svg', active: pathname === '/my-plan'});
    addItem({to: APP_ROUTE_PATHS.mockExams, label: t('navigation:exams'), asset: '/icons/figma-dashboard/exams.svg', active: pathname.startsWith('/mock-exams')});
    if (canAccessAiWorkspace(user)) addItem({to: APP_ROUTE_PATHS.aibot, label: t('common:sidebar.aiChatbot'), asset: '/icons/figma-dashboard/ai-chat.svg', active: pathname.startsWith('/aibot')});
    addItem({to: APP_ROUTE_PATHS.calendar, label: t('common:sidebar.calendar'), asset: '/icons/figma-dashboard/calendar.svg', active: pathname.startsWith('/calendar')});
    addItem({to: VOCABULARY_PATHS.root, label: t('common:sidebar.vocabulary'), icon: BookMarked, active: pathname.startsWith(VOCABULARY_PATHS.root)});
  }
  if (!student && counsellor) {
    addItem({to: APP_ROUTE_PATHS.counsellor, label: t('navigation:dashboard'), icon: LayoutDashboard, active: pathname === '/counsellor'});
    addItem({to: APP_ROUTE_PATHS.counsellorIntakes, label: t('navigation:unassignedIntakes'), icon: ClipboardList, active: pathname.startsWith('/counsellor/intakes')});
  }
  if (!student && advisor) {
    addItem({to: APP_ROUTE_PATHS.advisorOperations, label: advisorOnly ? t('navigation:dashboard') : t('navigation:advisorDashboard'), icon: LayoutDashboard, active: pathname === APP_ROUTE_PATHS.advisorOperations});
    addItem({to: APP_ROUTE_PATHS.advisorStudents, label: t('navigation:students'), icon: UsersRound, active: pathname.startsWith('/advisor/students')});
    addItem({to: APP_ROUTE_PATHS.advisorMessages, label: t('navigation:messages'), icon: MessageSquare, active: pathname === APP_ROUTE_PATHS.advisorMessages});
    addItem({to: APP_ROUTE_PATHS.advisorCourses, label: t('navigation:courseManagement'), icon: BookOpen, active: pathname === APP_ROUTE_PATHS.advisorCourses || pathname.startsWith('/advisor/courses/')});
    addItem({to: APP_ROUTE_PATHS.advisorTasks, label: t('navigation:actionTasks'), icon: ClipboardList, active: pathname === APP_ROUTE_PATHS.advisorTasks});
    addItem({to: APP_ROUTE_PATHS.advisorSchedule, label: t('navigation:scheduling'), icon: CalendarDays, active: pathname === APP_ROUTE_PATHS.advisorSchedule});
  }
  if (!student && instructor) {
    addItem({to: APP_ROUTE_PATHS.myOperations, label: t('navigation:teachingOperations'), icon: ClipboardList, active: pathname === '/my-operations'});
  }
  if (!student && parent) {
    const params = new URLSearchParams(search);
    const area = getParentArea(getParentSection(params));
    PARENT_AREAS.forEach(id => addItem({
      to: parentHref(id, params), label: t(PARENT_SECTIONS[id].label), icon: PARENT_ICONS[id],
      active: pathname === APP_ROUTE_PATHS.parent && area === id,
    }));
  }
  if (!student && canAccessStandaloneMockExams(user)) {
    addItem({to: APP_ROUTE_PATHS.mockExams, label: t('navigation:mockExams'), icon: GraduationCap, active: pathname.startsWith('/mock-exams')});
  }
  if (!student) standardItems.forEach(({item, originalIndex}) => {
    addItem({
      to: item.path,
      label: !isUserAccount && item.path === '/course' ? t('navigation:courses') : t(item.sidebarItem.translationLabel),
      icon: STANDARD_ICONS[item.path] ?? BookOpen,
      active: selectedSidebarIndex === originalIndex,
    });
  });
  if (isTenantAdminAccount(user)) {
    addItem({to: APP_ROUTE_PATHS.adminDashboard, label: t('navigation:dashboard'), icon: LayoutDashboard, active: pathname === APP_ROUTE_PATHS.adminDashboard});
    addItem({
      to: APP_ROUTE_PATHS.adminIntakes,
      label: t('navigation:intakes'),
      icon: ClipboardList,
      active: pathname.startsWith('/admin/intakes') || pathname.startsWith('/admin/students'),
    });
  }
  if (canUseAdminConsole) {
    addItem({
      to: APP_ROUTE_PATHS.admin,
      label: isTenantAdminAccount(user) ? t('navigation:governance') : t('navigation:adminConsole'),
      icon: Settings,
      active: pathname === APP_ROUTE_PATHS.admin,
    });
  }

  if (instructor && !advisor) {
    const order: string[] = [APP_ROUTE_PATHS.home, APP_ROUTE_PATHS.course, APP_ROUTE_PATHS.myOperations, APP_ROUTE_PATHS.mockExams, APP_ROUTE_PATHS.aibot, APP_ROUTE_PATHS.calendar, APP_ROUTE_PATHS.advisorOperations, APP_ROUTE_PATHS.advisorStudents, APP_ROUTE_PATHS.advisorMessages];
    navigationItems.sort((a, b) => order.indexOf(a.to) - order.indexOf(b.to));
  } else if (isTenantAdminAccount(user)) {
    const order: string[] = [APP_ROUTE_PATHS.adminDashboard, APP_ROUTE_PATHS.admin, APP_ROUTE_PATHS.mockExams, APP_ROUTE_PATHS.adminIntakes];
    navigationItems.sort((a, b) => order.indexOf(a.to) - order.indexOf(b.to));
  } else if (canUseAdminConsole) {
    const adminIndex = navigationItems.findIndex(item => item.to === APP_ROUTE_PATHS.admin);
    if (adminIndex > 0) navigationItems.unshift(...navigationItems.splice(adminIndex, 1));
  }

  const mobilePrimaryItems = navigationItems.slice(0, 4);
  const mobileMoreItems = navigationItems.slice(4);

  React.useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname, hash, search]);

  return (
    <aside className={styles.sidebar} data-collapsed={collapsed || undefined} data-workspace={isTenantAdminAccount(user) ? 'tenant' : user.role === 'USER' && user.level === 'INSTRUCTOR' ? 'instructor' : undefined} aria-label={t('navigation:primary')}>
      <Link to={homePath} className={styles.logo} aria-label={t('sidebar.dashboard')}>
        <img src="/icons/figma-dashboard/logo-mark.svg" alt=""/>
        <img className={styles.wordmark} src="/icons/figma-dashboard/logo-wordmark.svg" alt="X—LEARN"/>
      </Link>

      <button type="button" className={styles.collapseToggle} aria-label={collapsed ? t('navigation:expand') : t('navigation:collapse')} aria-expanded={!collapsed} onClick={() => setCollapsed(current => !current)}>{collapsed ? <PanelLeftOpen size={19}/> : <PanelLeftClose size={19}/>}</button>
      <nav className={styles.desktopNavigation}>
        <ul>
          {navigationItems.map(item => <NavigationItem key={item.to} {...item}/>)}
        </ul>
      </nav>

      <nav className={styles.mobileNavigation} aria-label={t('navigation:mobilePrimary')}>
        <ul>
          {mobilePrimaryItems.slice(0, 3).map(item => <NavigationItem key={item.to} {...item}/>)}
          {mobileMoreItems.length > 0 ? (
            <li>
              <button
                type="button"
                className={styles.moreButton}
                aria-expanded={isMoreOpen}
                aria-controls="mobile-more-navigation"
                onClick={() => setIsMoreOpen(open => !open)}
              >
                <Menu className={styles.navigationIcon} size={21} strokeWidth={1.8} aria-hidden="true"/>
                <span>{t('navigation:more')}</span>
              </button>
            </li>
          ) : null}
          {mobilePrimaryItems.slice(3).map(item => <NavigationItem key={item.to} {...item}/>)}
        </ul>
      </nav>

      {isMoreOpen && mobileMoreItems.length > 0 ? (
        <>
          <button type="button" className={styles.moreBackdrop} aria-label={t('navigation:closeMore')} onClick={() => setIsMoreOpen(false)}/>
          <nav id="mobile-more-navigation" className={styles.morePanel} aria-label={t('navigation:moreNavigation')}>
            <div className={styles.morePanelHeader}>
              <strong>{t('navigation:more')}</strong>
              <button type="button" aria-label={t('navigation:closeMore')} onClick={() => setIsMoreOpen(false)}>
                <X size={20} aria-hidden="true"/>
              </button>
            </div>
            <ul>
              {mobileMoreItems.map(item => <NavigationItem key={item.to} {...item} onNavigate={() => setIsMoreOpen(false)}/>)}
            </ul>
          </nav>
        </>
      ) : null}
    </aside>
  );
};

export default Sidebar;
