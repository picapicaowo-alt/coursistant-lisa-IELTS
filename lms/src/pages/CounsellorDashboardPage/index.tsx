import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {CheckCircle2, ChevronRight, ClipboardEdit, Inbox, Info, Plus, Sparkles, UserCheck, UserPlus, Users} from 'lucide-react';
import {unwrapData} from '@/apis';
import {counsellorApiService} from '@/apis/services/counsellor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import css from './index.module.scss';

const CounsellorDashboardPage: React.FC = () => {
  const [activeMetric, setActiveMetric] = useState<'created' | 'assigned' | null>(null);
  const query = useQuery({
    queryKey: advisingQueryKeys.counsellorDashboard,
    queryFn: async () => unwrapData(await counsellorApiService.getDashboard(), 'counsellorDashboard'),
  });

  const unassignedCount = query.data?.unassignedCount ?? 0;
  const unassignedTone = unassignedCount > 0 ? 'warning' : 'success';

  return (
    <div className={styles.page}>
      <div className={css.hero}>
        <div className={css.heroText}>
          <span className={css.kicker}><Sparkles size={14} aria-hidden="true"/> Intake pipeline</span>
          <h1>Intake dashboard</h1>
          <p className={css.lede}>Counts are independent. They do not have to add up.</p>
        </div>
        <Link className={css.createButton} to="/counsellor/intakes/new"><Plus size={18} aria-hidden="true"/>Create student</Link>
      </div>

      {query.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(query.error, 'Dashboard could not be loaded.')}</p> : null}
      {query.isPending ? <p className={styles.status}>Loading dashboard…</p> : null}

      {query.data ? (
        <section className={css.statsGrid} aria-label="Intake counts">
          <button
            type="button"
            className={css.statCard}
            data-tone="created"
            aria-pressed={activeMetric === 'created'}
            onClick={() => setActiveMetric(current => (current === 'created' ? null : 'created'))}
          >
            <span className={css.statIcon} aria-hidden="true"><UserPlus size={20}/></span>
            <span className={css.statBody}>
              <strong className={css.statValue}>{query.data.createdCount}</strong>
              <span className={css.statLabel}>Created</span>
              <small className={css.statHint}><Info size={13} aria-hidden="true"/>About this count</small>
            </span>
          </button>

          <button
            type="button"
            className={css.statCard}
            data-tone="assigned"
            aria-pressed={activeMetric === 'assigned'}
            onClick={() => setActiveMetric(current => (current === 'assigned' ? null : 'assigned'))}
          >
            <span className={css.statIcon} aria-hidden="true"><UserCheck size={20}/></span>
            <span className={css.statBody}>
              <strong className={css.statValue}>{query.data.assignedCount}</strong>
              <span className={css.statLabel}>Assigned</span>
              <small className={css.statHint}><Info size={13} aria-hidden="true"/>About handover</small>
            </span>
          </button>

          <Link className={css.statCard} data-tone={unassignedTone} to="/counsellor/intakes">
            <span className={css.statIcon} aria-hidden="true">{unassignedCount > 0 ? <Inbox size={20}/> : <CheckCircle2 size={20}/>}</span>
            <span className={css.statBody}>
              <strong className={css.statValue}>{unassignedCount}</strong>
              <span className={css.statLabel}>Unassigned</span>
              <small className={css.statHint}>Open queue<ChevronRight size={13} className={css.statChevron} aria-hidden="true"/></small>
            </span>
          </Link>
        </section>
      ) : null}

      {activeMetric ? (
        <section className={css.notice} aria-live="polite">
          <span className={css.noticeIcon} aria-hidden="true"><Info size={16}/></span>
          <div>
            <strong>{activeMetric === 'created' ? 'Created is a lifetime intake count' : 'Assigned means the handover is complete'}</strong>
            <p>{activeMetric === 'created' ? 'Cancelled records can remain in this count, so it may not equal Assigned plus Unassigned.' : 'Counsellor access ends as soon as a student is handed over. The assigned Advisor takes over the student record; contact your Tenant Admin if reassignment is needed.'}</p>
          </div>
        </section>
      ) : null}

      <section className={css.stepsSection} aria-label="Counsellor workflow">
        <div className={css.stepsHeading}>
          <strong>How an intake moves through your queue</strong>
          <span>Three steps take a student from first contact to a fully handed-over record.</span>
        </div>
        <div className={css.stepList}>
          <div className={css.step}>
            <div className={css.stepTop}>
              <span className={css.stepIndex} aria-hidden="true"><UserPlus size={18}/></span>
              <h3 className={css.stepTitle}>1. Create the intake</h3>
            </div>
            <p>Create the Student account and admissions record together. The student sets a password through Forgot password.</p>
          </div>
          <div className={css.step}>
            <div className={css.stepTop}>
              <span className={css.stepIndex} aria-hidden="true"><ClipboardEdit size={18}/></span>
              <h3 className={css.stepTitle}>2. Complete the record</h3>
            </div>
            <p>Edit your open intake and add or remove Parent links before assignment.</p>
          </div>
          <div className={css.step}>
            <div className={css.stepTop}>
              <span className={css.stepIndex} aria-hidden="true"><Users size={18}/></span>
              <h3 className={css.stepTitle}>3. Hand over to an Advisor</h3>
            </div>
            <p>Select an eligible Advisor. Successful assignment immediately closes Counsellor access.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CounsellorDashboardPage;
