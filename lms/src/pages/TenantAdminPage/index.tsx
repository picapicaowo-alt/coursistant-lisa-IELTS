import {Link, useSearchParams} from 'react-router-dom';
import {ClipboardList, FileCheck2, Settings2, ShieldCheck, UsersRound} from 'lucide-react';
import {DirectoryPanel} from './DirectoryPanel';
import {OwnershipPanel} from './OwnershipPanel';
import {AlertRulesPanel} from './AlertRulesPanel';
import {AuditPanel} from './AuditPanel';
import styles from './index.module.scss';

type Section = 'directory' | 'ownership' | 'alerts' | 'audit';
const sections: {id: Section; label: string; Icon: typeof UsersRound}[] = [
  {id: 'directory', label: 'People', Icon: UsersRound},
  {id: 'ownership', label: 'Course ownership', Icon: FileCheck2},
  {id: 'alerts', label: 'Alert rules', Icon: Settings2},
  {id: 'audit', label: 'Audit', Icon: ShieldCheck},
];

const TenantAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('section');
  const section: Section = sections.some(item => item.id === requested) ? requested as Section : 'directory';

  return <div className={styles.page}>
    <header className={styles.pageHeader}>
      <div><h1>Tenant governance</h1><p>Manage identity, intake, ownership, assessment templates, alert policy, and audit records for your institution.</p></div>
      <div className={styles.quickLinks}><Link to="/admin/intakes"><ClipboardList size={18}/><span><strong>Student intakes</strong><small>Create, assign, reassign, or cancel</small></span></Link><Link to="/mock-exams"><FileCheck2 size={18}/><span><strong>Mock templates</strong><small>Create and publish tenant papers</small></span></Link></div>
    </header>
    <nav className={styles.tabs} aria-label="Tenant governance sections">{sections.map(({id, label, Icon}) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} className={section === id ? styles.activeTab : ''} onClick={() => setSearchParams(id === 'directory' ? {} : {section: id})}><Icon size={17}/>{label}</button>)}</nav>
    {section === 'directory' ? <DirectoryPanel/> : null}
    {section === 'ownership' ? <OwnershipPanel/> : null}
    {section === 'alerts' ? <AlertRulesPanel/> : null}
    {section === 'audit' ? <AuditPanel/> : null}
  </div>;
};

export default TenantAdminPage;
