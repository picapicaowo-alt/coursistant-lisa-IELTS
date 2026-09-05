import type {TFunction} from 'i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {LANGUAGE_SWITCHER_ENABLED} from '@/i18n/configuration';
import {UserAvatar} from '@/components/UserAvatar';
import {useEffect, useRef, useState} from 'react';
import {Bell, ChevronDown, LogOut, Settings, ShieldCheck, UserRound, type LucideIcon} from 'lucide-react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../contexts/AuthContext';
import {useProfileIdentity} from '@/hooks/useProfileIdentity';
import NotificationCenter from '../components/NotificationCenter';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {getParentSection, parentHref, PARENT_SECTIONS} from '@/configs/parentNavigation';
import {canAccessAdminConsole, canAccessCourseCatalogue, isInstructorLevel, isParentAccount} from '@/utils/roleCapabilities';
import notificationStyles from '@/components/NotificationCenter/index.module.scss';
import styles from './Header.module.scss';

interface MenuItem {
  id: string;
  icon: LucideIcon;
  label: string;
  path?: string;
}

const getWorkspaceLabel = (pathname: string, instructor: boolean, t: TFunction): string => {
  if (pathname === '/') return t('navigation:dashboard');
  if (pathname.startsWith('/course')) return t('navigation:courses');
  if (pathname.startsWith('/calendar')) return t('common:sidebar.calendar');
  if (pathname.startsWith('/aibot')) return t('common:sidebar.aiWorkplace');
  if (pathname.startsWith('/mock-exams')) return t('navigation:mockExams');
  if (pathname === APP_ROUTE_PATHS.advisorMessages) return t('navigation:messages');
  if (pathname === APP_ROUTE_PATHS.advisorOperations) return t('navigation:dashboard');
  if (pathname.startsWith('/advisor/students')) return t('navigation:students');
  if (pathname.startsWith('/advisor')) return t('navigation:advisorOperations');
  if (pathname.startsWith('/counsellor')) return t('navigation:counsellorOperations');
  if (pathname.startsWith('/my-plan')) return t('navigation:myPlan');
  if (pathname.startsWith('/my-operations')) return instructor ? t('navigation:teachingOperations') : t('navigation:learningOperations');
  if (pathname.startsWith('/profile')) return t('common:menu.profile');
  if (pathname.startsWith('/settings')) return t('common:menu.settings');
  if (pathname.startsWith('/admin')) return t('navigation:administration');
  if (pathname.startsWith('/parent')) return t('navigation:studentProgress');
  if (pathname.startsWith('/vocabulary')) return t('common:sidebar.vocabulary');
  return 'X-Learn';
};

const Header = () => {
  const {t} = useTranslation();
  const {user, logout} = useAuth();
  const identity = useProfileIdentity(user);
  const {pathname, search} = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const name = identity.name || t('navigation:profileFallback');
  const email = user?.email;
  const profileImage = identity.avatar;
  const canUseAdminConsole = user ? canAccessAdminConsole(user) : false;
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const canSearchCourses = user ? canAccessCourseCatalogue(user) && user.role === 'USER' : false;
  const instructor = user ? isInstructorLevel(user) : false;

  useEffect(() => {
    if (!isProfileOpen) return;

    const handleClickOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsProfileOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileOpen]);

  const profileMenuItems: MenuItem[] = [
    ...(!isTenantAdmin ? [{id: 'profile', icon: UserRound, label: t('menu.profile'), path: '/profile'}] : []),
    {id: 'settings', icon: Settings, label: isTenantAdmin ? t('navigation:passwordSecurity') : t('menu.settings'), path: '/settings'},
    ...(canUseAdminConsole
      ? [{id: 'admin', icon: ShieldCheck, label: isTenantAdmin ? t('navigation:tenantGovernance') : t('navigation:adminConsole'), path: '/admin'}]
      : []),
    {id: 'logout', icon: LogOut, label: t('menu.signOut')},
  ];

  const handleItemClick = (item: MenuItem) => {
    setIsProfileOpen(false);
    if (item.id === 'logout') {
      void logout();
      return;
    }
    if (item.path) navigate(item.path);
  };

  return (
    <header className={`${styles.header} ${isTenantAdmin ? styles.tenantHeader : ''}`}>
      {canSearchCourses ? (
        <form
          className={styles.search}
          role="search"
          onSubmit={event => {
            event.preventDefault();
            if (searchQuery.trim()) navigate(`/course?search=${encodeURIComponent(searchQuery.trim())}`);
          }}
        >
          <img src="/icons/figma-dashboard/search.svg" alt=""/>
          <input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder={t("navigation:searchPrompt")}
            aria-label={t("navigation:searchCourses")}
          />
        </form>
      ) : (
        <div className={styles.workspaceContext}>
          <span>{t('navigation:workspace')}{isTenantAdmin ? ':' : ''}</span>
          <strong>{isTenantAdmin ? t('navigation:administration') : pathname === APP_ROUTE_PATHS.parent ? t(PARENT_SECTIONS[getParentSection(new URLSearchParams(search))].label) : getWorkspaceLabel(pathname, instructor, t)}</strong>
        </div>
      )}

      <div className={styles.accountActions}>
        {LANGUAGE_SWITCHER_ENABLED ? <LanguageSwitcher/> : null}
        {/* Parents have a separate notification contract and inbox in their portal. */}
        {user && isParentAccount(user) ? <Link className={notificationStyles.bellButton} to={parentHref('notifications', new URLSearchParams(search))} aria-label={t('common:navigationControls.openNotifications')}><Bell size={20}/></Link> : user?.role === 'USER' ? <NotificationCenter identity={user ?? undefined}/> : null}
        <div className={styles.profile} ref={menuRef}>
          <UserAvatar className={styles.avatar} src={profileImage}/>
          <div className={styles.profileCopy}>
            <strong>{name}</strong>
            <span>{isTenantAdmin ? t("navigation:tenantAdministrator") : email}</span>
          </div>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            onClick={() => setIsProfileOpen(open => !open)}
            aria-label={t('menu.profile')}
            aria-expanded={isProfileOpen}
            aria-controls="profile-menu"
          >
            <ChevronDown size={17} aria-hidden="true"/>
          </button>

          {isProfileOpen ? (
            <div id="profile-menu" className={styles.profileMenu}>
              {profileMenuItems.map(item => {
                const Icon = item.icon;
                return (
                  <button type="button" key={item.id} onClick={() => handleItemClick(item)}>
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true"/>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default Header;
