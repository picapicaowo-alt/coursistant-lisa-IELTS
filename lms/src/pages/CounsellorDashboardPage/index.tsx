import { useTranslation } from 'react-i18next';
import {Link} from 'react-router-dom';
import {Plus} from 'lucide-react';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {DashboardMetrics} from './DashboardMetrics';
import {IntakeTable} from './IntakeTable';
import {IntakePreview} from './IntakePreview';
import {AdvisorDirectory} from './AdvisorDirectory';
import {useCounsellorDashboard} from './useCounsellorDashboard';
import {useDashboardSizing} from './useDashboardSizing';
import styles from './index.module.scss';

const CounsellorDashboardPage = () => {
  const { t: translate } = useTranslation();
  const sizing = useDashboardSizing();
  const workspace = useCounsellorDashboard(sizing.intakePageSize, sizing.advisorPageSize);

  return (
    <div className={styles.page}>
      <div ref={sizing.canvasRef} className={styles.canvas}>
      <header className={styles.header}>
        <h1>{translate("advising:counsellor.dashboard")}</h1>
        <Link className={styles.primary} aria-label={translate("advising:counsellor.createStudent")} to={APP_ROUTE_PATHS.counsellorIntakesNew}>
          <Plus size={18} aria-hidden="true"/><span className={styles.createLabel}>{translate("advising:counsellor.createStudent")}</span><span className={styles.compactCreateLabel}>{translate("course:scheduleModal.createButton")}</span>
        </Link>
      </header>
      <DashboardMetrics query={workspace.metrics}/>
      <div className={styles.contentGrid}>
        <IntakeTable query={workspace.intakes} selectedId={workspace.selectedId}
          onSelect={workspace.selectIntake} onPageChange={workspace.changeIntakePage} tableRef={sizing.tableRef}/>
        <IntakePreview query={workspace.detail} parents={workspace.parents}
          selectedId={workspace.selectedId} unavailable={workspace.unavailable}/>
        <AdvisorDirectory query={workspace.advisors} onPageChange={workspace.changeAdvisorPage}/>
      </div>
      </div>
    </div>
  );
};

export default CounsellorDashboardPage;
