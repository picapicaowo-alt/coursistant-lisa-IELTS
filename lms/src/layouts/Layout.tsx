import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import {matchPath, Outlet, useLocation} from "react-router-dom";
import styles from './Layout.module.scss';
import {shouldShowAppShell} from "@/configs/routes.config";
import {ErrorBoundary} from "@/components/ErrorBoundary";
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';

const Layout: React.FC = () => {
  const location = useLocation();
  const {user} = useRequiredAuth();
  const mainContentRef = React.useRef<HTMLElement | null>(null);
  
  // Course overview uses the application shell for students and instructors.
  // Opening a material keeps the focused reading experience.
  const courseOverview = user.role === 'USER' && (user.level === 'INSTRUCTOR' || user.level === 'STUDENT')
    && matchPath({path: APP_ROUTE_PATHS.courseCourseId, end: true}, location.pathname)
    && !new URLSearchParams(location.search).has('materialId');
  const showLayout = Boolean(courseOverview) || shouldShowAppShell(location.pathname, location.search);

  React.useEffect(() => {
    // The shell's main element is the scroll container. React Router reuses it
    // between pages, so without an explicit reset a shorter destination can
    // open halfway down (and hide the AI Workplace heading).
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
  }, [location.pathname, showLayout]);
  
  return (
    <div className={styles.layoutContainer}>
      {showLayout && <Sidebar/>}
      <div className={`${styles.contentArea} ${showLayout ? styles.withNavigation : ''}`}>
        {showLayout && <Header/>}
        {/* Scoped to the page so a failed route keeps the shell — the user can
            still navigate somewhere else instead of facing a blank window.
            Keyed on the path so moving to another page clears the error. */}
        <main ref={mainContentRef} className={styles.mainContent}>
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet/>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
export default Layout;
