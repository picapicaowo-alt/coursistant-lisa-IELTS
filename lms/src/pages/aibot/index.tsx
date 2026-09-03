import {lazy, Suspense, useState} from 'react';
import WorkflowPanel from './WorkflowPanel';
import styles from './index.module.scss';
const StudySupportChat = lazy(() => import('../../components/ChatContent'));

export default function AIBotPage() {
  const [active, setActive] = useState<'study' | 'workflow'>('study');
  return <main className={styles.page}>
    <h1 className={styles.srOnly}>AI ChatBot</h1>
    <nav className={styles.toolTabs} aria-label="AI tools"><button type="button" aria-pressed={active === 'study'} onClick={() => setActive('study')}>Study Support</button><button type="button" aria-pressed={active === 'workflow'} onClick={() => setActive('workflow')}>Workflow</button></nav>
    <div className={styles.focusedWorkspace}>
      <section className={styles.assistantWorkspace} hidden={active !== 'study'} aria-label="Study Support">
        <Suspense fallback={<div className={styles.loading}>Loading Study Support…</div>}><StudySupportChat isIntroTop isDashboard={false} isWorkspace/></Suspense>
      </section>
      <WorkflowPanel isExpanded isHidden={active !== 'workflow'}/>
    </div>
  </main>;
}
