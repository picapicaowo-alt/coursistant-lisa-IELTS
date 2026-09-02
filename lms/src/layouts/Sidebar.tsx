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
    <Link to={to} onClick={onNavigate} className={styles.navigationItem} data-active={active || undefined} aria-current={active ? 'page' : undefined}>
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
  const {pathname} = useLocation();
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
  const homePath = getSignedInHomePath(user);
  const standardItems = SIDEBAR_CONFIGS
    .map((item, originalIndex) => ({item, originalIndex}))
    .filter(({item}) => {
      if (counsellor || advisorOnly || parent) return false;
      if (item.path === '/') return canAccessDashboard(user);
      if (item.path === '/course') return canAccessCourseCatalogue(user);
      if (item.path === '/calendar') return canAccessCalendar(user);
      if (item.path === VOCABULARY_PATHS.root) return student;
      if (item.path === '/aibot') return canAccessAiWorkspace(user);
      return false;
    });

  const navigationItems: NavigationItemProps[] = [];
  const addItem = (item: NavigationItemProps) => navigationItems.push(item);

  if (student) {
    addItem({to: '/', label: 'Dashboard', asset: '/icons/figma-dashboard/home.svg', active: pathname === '/'});
    addItem({to: '/course', label: 'My Courses', asset: '/icons/figma-dashboard/courses.svg', active: pathname.startsWith('/course')});
    addItem({to: '/my-plan', label: 'Study Plan', asset: '/icons/figma-dashboard/study-plan.svg', active: pathname === '/my-plan'});
    addItem({to: '/mock-exams', label: 'Exams', asset: '/icons/figma-dashboard/exams.svg', active: pathname.startsWith('/mock-exams')});
    addItem({to: '/aibot', label: 'AI ChatBot', asset: '/icons/figma-dashboard/ai-chat.svg', active: pathname.startsWith('/aibot')});
    addItem({to: '/calendar', label: 'Calendar', asset: '/icons/figma-dashboard/calendar.svg', active: pathname.startsWith('/calendar')});
  }
  if (!student && counsellor) {
    addItem({to: '/counsellor', label: 'Dashboard', icon: LayoutDashboard, active: pathname === '/counsellor'});
    addItem({to: '/counsellor/intakes', label: 'Unassigned intakes', icon: ClipboardList, active: pathname.startsWith('/counsellor/intakes')});
  }
  if (!student && advisor) {
    addItem({to: '/advisor/operations', label: 'Operations', icon: ClipboardList, active: pathname.startsWith('/advisor/operations')});
    addItem({to: '/advisor/students', label: 'Students', icon: UsersRound, active: pathname.startsWith('/advisor/students')});
  }
  if (!student && instructor) {
    addItem({to: '/my-operations', label: 'Teaching operations', icon: ClipboardList, active: pathname === '/my-operations'});
  }
  if (!student && parent) {
    addItem({to: '/parent', label: 'Student progress', icon: ChartNoAxesCombined, active: pathname.startsWith('/parent')});
  }
  if (!student && canAccessStandaloneMockExams(user)) {
    addItem({to: '/mock-exams', label: 'Mock exams', icon: GraduationCap, active: pathname.startsWith('/mock-exams')});
  }
  if (!student) standardItems.forEach(({item, originalIndex}) => {
    addItem({
      to: item.path,
      label: !isUserAccount && item.path === '/course' ? 'Courses' : t(item.sidebarItem.translationLabel),
      icon: STANDARD_ICONS[item.path] ?? BookOpen,
      active: selectedSidebarIndex === originalIndex,
    });
  });
  if (isTenantAdminAccount(user)) {
    addItem({
      to: '/admin/intakes',
      label: 'Intakes',
      icon: ClipboardList,
      active: pathname.startsWith('/admin/intakes') || pathname.startsWith('/admin/students'),
    });
  }
  if (canUseAdminConsole) {
    addItem({
      to: '/admin',
      label: isTenantAdminAccount(user) ? 'Governance' : 'Admin Console',
      icon: Settings,
      active: pathname === '/admin' || (pathname.startsWith('/admin/') && !pathname.startsWith('/admin/intakes') && !pathname.startsWith('/admin/students')),
    });
  }

  const mobilePrimaryItems = navigationItems.slice(0, 4);
  const mobileMoreItems = navigationItems.slice(4);

  React.useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  return (
    <aside className={styles.sidebar} aria-label="Primary navigation">
      <Link to={homePath} className={styles.logo} aria-label={t('sidebar.dashboard')}>
        <img src="/icons/figma-dashboard/logo-mark.svg" alt=""/>
        <img className={styles.wordmark} src="/icons/figma-dashboard/logo-wordmark.svg" alt="X—LEARN"/>
      </Link>

      <nav className={styles.desktopNavigation}>
        <ul>
          {navigationItems.map(item => <NavigationItem key={item.to} {...item}/>)}
        </ul>
      </nav>

      <nav className={styles.mobileNavigation} aria-label="Mobile primary navigation">
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
                <span>More</span>
              </button>
            </li>
          ) : null}
          {mobilePrimaryItems.slice(3).map(item => <NavigationItem key={item.to} {...item}/>)}
        </ul>
      </nav>

      {isMoreOpen && mobileMoreItems.length > 0 ? (
        <>
          <button type="button" className={styles.moreBackdrop} aria-label="Close more navigation" onClick={() => setIsMoreOpen(false)}/>
          <nav id="mobile-more-navigation" className={styles.morePanel} aria-label="More navigation">
            <div className={styles.morePanelHeader}>
              <strong>More</strong>
              <button type="button" aria-label="Close more navigation" onClick={() => setIsMoreOpen(false)}>
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
