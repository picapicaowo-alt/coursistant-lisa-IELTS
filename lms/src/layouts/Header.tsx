import {useEffect, useRef, useState} from 'react';
import {ChevronDown, LogOut, Settings, ShieldCheck, UserRound, type LucideIcon} from 'lucide-react';
import {useLocation, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../contexts/AuthContext';
import NotificationCenter from '../components/NotificationCenter';
import {canAccessAdminConsole, canAccessCourseCatalogue, isInstructorLevel} from '@/utils/roleCapabilities';
import styles from './Header.module.scss';

interface MenuItem {
  id: string;
  icon: LucideIcon;
  label: string;
  path?: string;
}

const getWorkspaceLabel = (pathname: string, instructor: boolean): string => {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/course')) return 'Courses';
  if (pathname.startsWith('/calendar')) return 'Calendar';
  if (pathname.startsWith('/aibot')) return 'AI Workplace';
  if (pathname.startsWith('/mock-exams')) return 'Mock exams';
  if (pathname.startsWith('/advisor/students')) return 'Students';
  if (pathname.startsWith('/advisor')) return 'Advisor operations';
  if (pathname.startsWith('/counsellor')) return 'Counsellor operations';
  if (pathname.startsWith('/my-plan')) return 'My plan';
  if (pathname.startsWith('/my-operations')) return instructor ? 'Teaching operations' : 'Learning operations';
  if (pathname.startsWith('/profile')) return 'Profile';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/admin')) return 'Administration';
  if (pathname.startsWith('/parent')) return 'Student progress';
  if (pathname.startsWith('/vocabulary')) return 'Vocabulary';
  return 'X-Learn';
};

const Header = () => {
  const {t} = useTranslation();
  const {user, logout} = useAuth();
  const {pathname} = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const name = user?.name;
  const email = user?.email;
  const profileImage = user?.avatar || '/icons/default_avatar.jpg';
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
    {id: 'settings', icon: Settings, label: isTenantAdmin ? 'Password & security' : t('menu.settings'), path: '/settings'},
    ...(canUseAdminConsole
      ? [{id: 'admin', icon: ShieldCheck, label: isTenantAdmin ? 'Tenant governance' : 'Admin Console', path: '/admin'}]
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
    <header className={styles.header}>
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
            placeholder="What do you want to learn?"
            aria-label="Search courses"
          />
        </form>
      ) : (
        <div className={styles.workspaceContext}>
          <span>Workspace</span>
          <strong>{getWorkspaceLabel(pathname, instructor)}</strong>
        </div>
      )}

      <div className={styles.accountActions}>
        {user?.role === 'USER' ? <NotificationCenter/> : null}
        <div className={styles.profile} ref={menuRef}>
          <img
            className={styles.avatar}
            src={profileImage}
            alt=""
            onError={event => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = '/icons/default_avatar.jpg';
            }}
          />
          <div className={styles.profileCopy}>
            <strong>{name}</strong>
            <span>{email}</span>
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
