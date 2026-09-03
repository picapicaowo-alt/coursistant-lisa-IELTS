import {UserAvatar} from '@/components/UserAvatar';
import React from "react";
import {Navigate} from "react-router-dom";
import styles from "./index.module.scss"
import {Dashboard} from "@/pages/LmsHomePage/components/Dashboard";
import {useRequiredAuth} from "@/contexts/RequiredAuthContext";
import {getSignedInHomePath} from '@/utils/signedInHomePath';
import {isInstructorLevel} from '@/utils/roleCapabilities';

const LMSHome: React.FC = () => {
  const {user} = useRequiredAuth();

  const homePath = getSignedInHomePath(user);
  if (homePath !== '/') return <Navigate to={homePath} replace/>;

  return <UserDashboard/>;
};

const UserDashboard: React.FC = () => {
  const {user} = useRequiredAuth();
  const instructor = isInstructorLevel(user);
  
  return (
    <section className={styles.dashboardPage} aria-labelledby="dashboard-title">
      <header className={styles.welcomeHeader}>
        <UserAvatar src={user.avatar} className={styles.welcomeAvatar}/>
        <h1 id="dashboard-title">Welcome back, {user.name || (instructor ? 'instructor' : 'learner')}!</h1>
      </header>
      <Dashboard audience={instructor ? 'instructor' : 'student'}/>
    </section>
  );
};

export default LMSHome;
