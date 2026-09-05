import {useTranslation} from 'react-i18next';
import {lazy, Suspense, useState} from 'react';
import WorkflowPanel from './WorkflowPanel';
import styles from './index.module.scss';
const StudySupportChat = lazy(() => import('../../components/ChatContent'));

export default function AIBotPage() {
  const {t: translate} = useTranslation();
  const [active, setActive] = useState<'study' | 'workflow'>('study');
  return <main className={styles.page}>
    <h1 className={styles.srOnly}>{translate("assistant:workspace.title")}</h1>
    <nav className={styles.toolTabs} aria-label={translate("assistant:workspace.tools")}><button type="button" aria-pressed={active === 'study'} onClick={() => setActive('study')}>{translate("assistant:workspace.study")}</button><button type="button" aria-pressed={active === 'workflow'} onClick={() => setActive('workflow')}>{translate("assistant:workspace.workflow")}</button></nav>
    <div className={styles.focusedWorkspace}>
      <section className={styles.assistantWorkspace} hidden={active !== 'study'} aria-label={translate("assistant:workspace.study")}>
        <Suspense fallback={<div className={styles.loading}>{translate("assistant:workspace.loading")}</div>}><StudySupportChat isIntroTop isDashboard={false} isWorkspace/></Suspense>
      </section>
      <WorkflowPanel isExpanded isHidden={active !== 'workflow'}/>
    </div>
  </main>;
}
