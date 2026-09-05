import {formatNumber, formatPercent} from '@/i18n/formatting';
import {recordFieldLabel} from '@/components/RecordSummaryList/recordPresentation';
import {useTranslation} from 'react-i18next';
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
  const {t: translate} = useTranslation();
  const record = asRecord(value);
  if (!record || !Object.keys(record).length) return <WorkspaceSection title={translate("learning:parent.overview")}><RecordSummaryList value={value} emptyMessage={translate("learning:parent.overviewEmpty")}/></WorkspaceSection>;
  const hours = asRecord(record.hours);
  const attendance = asRecord(record.attendance);
  const attended = attendance ? parentNumber(attendance, 'attended') : undefined;
  const total = attendance ? parentNumber(attendance, 'total') : undefined;
  const attendanceRate = attended != null && total ? Math.round((attended / total) * 100) : undefined;
  // Parent academic reads have an open response schema. Preserve additional returned
  // information in a disclosure instead of silently assuming or discarding it.
  const additional = withoutFields(record, ['student', 'currentCourses', 'hours', 'attendance']);
  const quickLinks = [
    {section: 'learning' as const, titleKey: "navigation:parent.studyPlan", descriptionKey: "learning:parent.planLinkHelp", icon: BookOpen},
    {section: 'schedule' as const, titleKey: "course:schedule.title", descriptionKey: "learning:parent.scheduleLinkHelp", icon: CalendarDays},
    {section: 'reports' as const, titleKey: "navigation:parent.reports", descriptionKey: "learning:parent.reportLinkHelp", icon: FileText},
    {section: 'messages' as const, titleKey: "learning:parent.contactTeam", descriptionKey: "learning:parent.contactHelp", icon: MessageSquare},
  ];
  return <div className={styles.overviewGrid}>
    <WorkspaceSection
      title={translate("learning:parent.currentCourses")}
      className={styles.overviewCourses}
      meta={<Link className={styles.textLink} to={parentHref('learning', params, 'courses')}>{translate("learning:parent.viewLearning")}{' '}<ArrowUpRight size={16} aria-hidden="true"/></Link>}
    >
        <ParentCourseList value={record.currentCourses}/>
    </WorkspaceSection>
    <WorkspaceSection title={translate("learning:parent.progressSummary")} className={styles.overviewSummary} bodyClassName={styles.progressSummary}>
      <div className={styles.summaryGroup}>
        <span className={styles.iconTile}><Clock3 size={21} aria-hidden="true"/></span>
        <div className={styles.summaryContent}>
          <strong>{translate("learning:hours.title")}</strong>
          {hours ? <dl>
            <div><dt>{recordFieldLabel('purchasedMinutes')}</dt><dd>{parentNumber(hours, 'purchasedMinutes') == null ? '—' : formatNumber(parentNumber(hours, 'purchasedMinutes')!)}</dd></div>
            <div><dt>{recordFieldLabel('usedMinutes')}</dt><dd>{parentNumber(hours, 'usedMinutes') == null ? '—' : formatNumber(parentNumber(hours, 'usedMinutes')!)}</dd></div>
            <div className={styles.summaryTotal}><dt>{recordFieldLabel('remainingMinutes')}</dt><dd>{parentNumber(hours, 'remainingMinutes') == null ? '—' : formatNumber(parentNumber(hours, 'remainingMinutes')!)}</dd></div>
          </dl> : <p>{translate("learning:parent.hoursUnavailable")}</p>}
        </div>
      </div>
      <div className={styles.summaryGroup}>
        <span className={styles.iconTile}><CalendarCheck2 size={21} aria-hidden="true"/></span>
        <div className={styles.summaryContent}>
          <strong>{translate("operations:tabs.attendance")}</strong>
          {attendance ? <dl>
            <div><dt>{translate("learning:parent.attendedClasses")}</dt><dd>{attended == null ? '—' : formatNumber(attended)}</dd></div>
            <div><dt>{translate("learning:parent.totalClasses")}</dt><dd>{total == null ? '—' : formatNumber(total)}</dd></div>
            <div className={styles.summaryTotal}><dt>{recordFieldLabel('attendanceRate')}</dt><dd>{attendanceRate == null ? '—' : formatPercent(attendanceRate / 100)}</dd></div>
          </dl> : <p>{translate("learning:parent.attendanceUnavailable")}</p>}
        </div>
      </div>
      {Object.entries(additional).some(([key]) => isDisplayField(key)) ? <details className={styles.details}><summary>{translate("learning:parent.moreProgress")}</summary><RecordSummaryList value={additional}/></details> : null}
    </WorkspaceSection>
    <WorkspaceSection title={translate("learning:parent.explore")} className={styles.overviewLinks} bodyClassName={styles.quickLinks}>
      {quickLinks.map(({section, titleKey, descriptionKey, icon: Icon}) => <Link key={section} to={parentHref(section, params)}>
        <span className={styles.quickLinkIcon}><Icon size={21} aria-hidden="true"/></span>
        <span><strong>{translate(titleKey)}</strong><small>{translate(descriptionKey)}</small></span>
        <ArrowRight size={18} aria-hidden="true"/>
      </Link>)}
    </WorkspaceSection>
  </div>;
}
