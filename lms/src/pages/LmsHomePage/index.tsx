import React from "react";
import {Navigate} from "react-router-dom";
import styles from "./index.module.scss"
import {Dashboard} from "@/pages/LmsHomePage/components/Dashboard";
import {useRequiredAuth} from "@/contexts/RequiredAuthContext";
import {getSignedInHomePath} from '@/utils/signedInHomePath';

const LMSHome: React.FC = () => {
  const {user} = useRequiredAuth();

  const homePath = getSignedInHomePath(user);
  if (homePath !== '/') return <Navigate to={homePath} replace/>;

  return <UserDashboard/>;
};

const UserDashboard: React.FC = () => {
  const {user} = useRequiredAuth();
  
  return (
    <section className={styles.dashboardPage} aria-labelledby="dashboard-title">
      <header className={styles.welcomeHeader}>
        <img
          src={user.avatar || '/icons/figma-dashboard/avatar.png'}
          alt=""
          onError={event => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = '/icons/default_avatar.jpg';
          }}
        />
        <h1 id="dashboard-title">Welcome back, {user.name || 'learner'}!</h1>
        <img className={styles.wave} src="/icons/figma-dashboard/wave.png" alt=""/>
      </header>
      <Dashboard/>
    </section>
  );
};

export default LMSHome;
