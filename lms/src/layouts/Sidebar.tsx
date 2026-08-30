import React from 'react';
import {Link, useLocation} from 'react-router-dom';
import styles from './Sidebar.module.scss';
import {useTranslation} from 'react-i18next';
import {getSidebarIndex, SIDEBAR_CONFIGS} from "@/configs/routes.config";
import {useRequiredAuth} from "@/contexts/RequiredAuthContext";
import {getSignedInHomePath, isAdvisorLevel, isCounsellorLevel, isParentLevel, isStudentLevel, isTenantAdminRole} from '@/utils/signedInHomePath';
import {
  canAccessCourseCatalogue,
  canAccessStandaloneMockExams,
  isInstructorLevel,
  isPureAdvisor,
} from '@/utils/roleCapabilities';
import {BookOpen} from 'lucide-react';
import {VOCABULARY_PATHS} from '@/pages/vocabulary/routes';

const Sidebar: React.FC = () => {
  const {t} = useTranslation();
  const {user} = useRequiredAuth();
  const {pathname} = useLocation();
  const selectedSidebarIndex = getSidebarIndex(pathname);
  const isUserAccount = user.role === 'USER';
  const counsellor = isCounsellorLevel(user.level);
  const advisor = isAdvisorLevel(user.level);
  const advisorOnly = isPureAdvisor(user);
  const student = isStudentLevel(user.level);
  const instructor = isInstructorLevel(user);
  const parent = isParentLevel(user.level);
  const canUseAdminConsole = user.role === 'SYSTEM_ADMIN' || user.role === 'TENANT_ADMIN';
  const homePath = getSignedInHomePath(user);
  const showLmsNav = isUserAccount && canAccessCourseCatalogue(user);
  const sidebarItems = SIDEBAR_CONFIGS
    .map((item, originalIndex) => ({item, originalIndex}))
    .filter(({item}) => {
      if (counsellor || advisorOnly || parent) return false;
      if (item.path === VOCABULARY_PATHS.root) return student;
      return showLmsNav || item.path === '/course';
    });
  
  return (
    <div className={styles.sidebar}>
      <Link
        to={homePath}
        className={styles.logo}
        aria-label={t("sidebar.dashboard")}
      >
        <img className="p-1 align-middle" src="/icons/coursistant_icon_ver2.png" alt="Logo"/>
      </Link>
      <nav>
        <ul>
          {counsellor ? (
            <>
              <li>
                <Link to="/counsellor">
                  <div className={`${styles.itemContent} ${pathname === '/counsellor' ? styles.active : ''}`}>
                    <img src="/icons/home_fill.png" alt="" className={styles.responsiveImage}/>
                    <span>Dashboard</span>
                  </div>
                </Link>
              </li>
              <li>
                <Link to="/counsellor/intakes">
                  <div className={`${styles.itemContent} ${pathname.startsWith('/counsellor/intakes') ? styles.active : ''}`}>
                    <img src="/icons/course_unfill.png" alt="" className={styles.responsiveImage}/>
                    <span>Unassigned intakes</span>
                  </div>
                </Link>
              </li>
            </>
          ) : null}
          {advisor ? (
            <>
              <li>
                <Link to="/advisor/operations">
                  <div className={`${styles.itemContent} ${pathname.startsWith('/advisor/operations') ? styles.active : ''}`}>
                    <img src="/icons/home_fill.png" alt="" className={styles.responsiveImage}/>
                    <span>Operations</span>
                  </div>
                </Link>
              </li>
              <li>
                <Link to="/advisor/students">
                  <div className={`${styles.itemContent} ${pathname.startsWith('/advisor/students') ? styles.active : ''}`}>
                    <img src="/icons/course_unfill.png" alt="" className={styles.responsiveImage}/>
                    <span>Students</span>
                  </div>
                </Link>
              </li>
            </>
          ) : null}
          {student ? (
            <>
              <li>
                <Link to="/my-plan">
                  <div className={`${styles.itemContent} ${pathname === '/my-plan' ? styles.active : ''}`}>
                    <img src="/icons/course_unfill.png" alt="" className={styles.responsiveImage}/>
                    <span>My plan</span>
                  </div>
                </Link>
              </li>
              <li>
                <Link to="/my-operations">
                  <div className={`${styles.itemContent} ${pathname === '/my-operations' ? styles.active : ''}`}>
                    <img src="/icons/calendar_unfill.svg" alt="" className={styles.responsiveImage}/>
                    <span>Learning overview</span>
                  </div>
                </Link>
              </li>
            </>
          ) : null}
          {instructor ? (
            <li>
              <Link to="/my-operations">
                <div className={`${styles.itemContent} ${pathname === '/my-operations' ? styles.active : ''}`}>
                  <img src="/icons/calendar_unfill.svg" alt="" className={styles.responsiveImage}/>
                  <span>Teaching operations</span>
                </div>
              </Link>
            </li>
          ) : null}
          {parent ? (
            <li>
              <Link to="/parent">
                <div className={`${styles.itemContent} ${pathname.startsWith('/parent') ? styles.active : ''}`}>
                  <img src="/icons/home_fill.png" alt="" className={styles.responsiveImage}/>
                  <span>Student progress</span>
                </div>
              </Link>
            </li>
          ) : null}
          {canAccessStandaloneMockExams(user) ? (
            <li>
              <Link to="/mock-exams">
                <div className={`${styles.itemContent} ${pathname.startsWith('/mock-exams') ? styles.active : ''}`}>
                  <img src="/icons/course_unfill.png" alt="" className={styles.responsiveImage}/>
                  <span>Mock exams</span>
                </div>
              </Link>
            </li>
          ) : null}
          {
            sidebarItems.map(({item, originalIndex}) => (
              <li key={item.path}>
                <Link to={item.path}>
                  <div className={`${styles.itemContent} ${selectedSidebarIndex === originalIndex ? styles.active : ''}`}>
                    {item.sidebarItem.icon === 'vocabulary' ? (
                      <BookOpen className={styles.responsiveIcon} aria-hidden="true"/>
                    ) : (
                      <img
                        src={selectedSidebarIndex === originalIndex ? item.sidebarItem.filledIcon : item.sidebarItem.unfilledIcon}
                        alt={item.name}
                        className={styles.responsiveImage}
                      />
                    )}
                    <span>{!isUserAccount && item.path === '/course' ? 'Courses' : t(item.sidebarItem.translationLabel)}</span>
                  </div>
                </Link>
              </li>
            ))
          }
          {isTenantAdminRole(user.role) ? (
            <li>
              <Link to="/admin/intakes">
                <div className={`${styles.itemContent} ${pathname.startsWith('/admin/intakes') || pathname.startsWith('/admin/students') ? styles.active : ''}`}>
                  <img src="/icons/course_unfill.png" alt="" className={styles.responsiveImage}/>
                  <span>Intakes</span>
                </div>
              </Link>
            </li>
          ) : null}
          {canUseAdminConsole ? (
            <li>
              <Link to="/admin">
                <div className={`${styles.itemContent} ${pathname === '/admin' || (pathname.startsWith('/admin/') && !pathname.startsWith('/admin/intakes') && !pathname.startsWith('/admin/students')) ? styles.active : ''}`}>
                  <img src="/icons/profile-menu/setting.png" alt="Admin Console" className={styles.responsiveImage}/>
                  <span>Admin Console</span>
                </div>
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
