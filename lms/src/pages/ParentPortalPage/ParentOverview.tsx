import {Link} from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CalendarCheck2,
  Clock3,
  FileText,
  MessageSquare,
} from 'lucide-react';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {isDisplayField} from '@/components/RecordSummaryList/recordPresentation';
import {parentHref} from '@/configs/parentNavigation';
import {ParentCourseList} from './ParentCourseList';
import {asRecord, parentNumber, withoutFields} from './parentPresentation';
import styles from './index.module.scss';

export function ParentOverview({value, params}: {value: unknown; params: URLSearchParams}) {
  const record = asRecord(value);
  if (!record || !Object.keys(record).length) return <WorkspaceSection title="Academic overview"><RecordSummaryList value={value} emptyMessage="Academic updates will appear here when the advising team shares them."/></WorkspaceSection>;
  const hours = asRecord(record.hours);
  const attendance = asRecord(record.attendance);
  const attended = attendance ? parentNumber(attendance, 'attended') : undefined;
  const total = attendance ? parentNumber(attendance, 'total') : undefined;
  const attendanceRate = attended != null && total ? Math.round((attended / total) * 100) : undefined;
  // Parent academic reads have an open response schema. Preserve additional returned
  // information in a disclosure instead of silently assuming or discarding it.
  const additional = withoutFields(record, ['student', 'currentCourses', 'hours', 'attendance']);
  const quickLinks = [
    {section: 'learning' as const, title: 'Study plan', description: 'Goals, checkpoints and learning tasks', icon: BookOpen},
    {section: 'schedule' as const, title: 'Schedule', description: 'Classes and schedule change requests', icon: CalendarDays},
    {section: 'reports' as const, title: 'Reports', description: 'Published learning reports', icon: FileText},
    {section: 'messages' as const, title: 'Contact advising team', description: 'Conversation and academic notifications', icon: MessageSquare},
  ];
  return <div className={styles.overviewGrid}>
    <WorkspaceSection
      title="Current courses"
      className={styles.overviewCourses}
      meta={<Link className={styles.textLink} to={parentHref('learning', params, 'courses')}>View learning <ArrowUpRight size={16} aria-hidden="true"/></Link>}
    >
        <ParentCourseList value={record.currentCourses}/>
    </WorkspaceSection>
    <WorkspaceSection title="Progress summary" className={styles.overviewSummary} bodyClassName={styles.progressSummary}>
      <div className={styles.summaryGroup}>
        <span className={styles.iconTile}><Clock3 size={21} aria-hidden="true"/></span>
        <div className={styles.summaryContent}>
          <strong>Course hours</strong>
          {hours ? <dl>
            <div><dt>Purchased minutes</dt><dd>{parentNumber(hours, 'purchasedMinutes') ?? '—'}</dd></div>
            <div><dt>Used minutes</dt><dd>{parentNumber(hours, 'usedMinutes') ?? '—'}</dd></div>
            <div className={styles.summaryTotal}><dt>Remaining minutes</dt><dd>{parentNumber(hours, 'remainingMinutes') ?? '—'}</dd></div>
          </dl> : <p>Course-hour information is not available yet.</p>}
        </div>
      </div>
      <div className={styles.summaryGroup}>
        <span className={styles.iconTile}><CalendarCheck2 size={21} aria-hidden="true"/></span>
        <div className={styles.summaryContent}>
          <strong>Attendance</strong>
          {attendance ? <dl>
            <div><dt>Attended classes</dt><dd>{attended ?? '—'}</dd></div>
            <div><dt>Total classes</dt><dd>{total ?? '—'}</dd></div>
            <div className={styles.summaryTotal}><dt>Attendance rate</dt><dd>{attendanceRate == null ? '—' : `${attendanceRate}%`}</dd></div>
          </dl> : <p>Attendance information is not available yet.</p>}
        </div>
      </div>
      {Object.entries(additional).some(([key]) => isDisplayField(key)) ? <details className={styles.details}><summary>More progress details</summary><RecordSummaryList value={additional}/></details> : null}
    </WorkspaceSection>
    <WorkspaceSection title="Continue exploring" className={styles.overviewLinks} bodyClassName={styles.quickLinks}>
      {quickLinks.map(({section, title, description, icon: Icon}) => <Link key={section} to={parentHref(section, params)}>
        <span className={styles.quickLinkIcon}><Icon size={21} aria-hidden="true"/></span>
        <span><strong>{title}</strong><small>{description}</small></span>
        <ArrowRight size={18} aria-hidden="true"/>
      </Link>)}
    </WorkspaceSection>
  </div>;
}
