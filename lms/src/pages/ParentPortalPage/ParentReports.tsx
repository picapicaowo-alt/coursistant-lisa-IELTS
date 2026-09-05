import {recordFieldLabel} from '@/components/RecordSummaryList/recordPresentation';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  Lightbulb,
  ShieldCheck,
  Star,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {ParentReportDetail} from '@/apis';
import {AdvisingBadge} from '@/components/AdvisingBadge';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {formatUtcTimestamp} from '@/utils/datetime';
import {asRecord, parentLabel, parentNumber, parentRecords, parentText} from './parentPresentation';
import styles from './index.module.scss';
import shared from '../advising/advising.module.scss';

const reportDate = (value?: string): string | undefined => value ? formatUtcTimestamp(value, {month: 'short', day: 'numeric', year: 'numeric'}) : undefined;

const DETAIL_FIELDS: Array<{key: keyof ParentReportDetail; icon: LucideIcon}> = [
  {key: 'strengths', icon: Star},
  {key: 'weaknesses', icon: TriangleAlert},
  {key: 'skillEvaluation', icon: ChartNoAxesCombined},
  {key: 'improvementSuggestions', icon: Lightbulb},
];

export function ParentReports({
  value,
  loading,
  listError,
  page,
  onPage,
  selectedId,
  onSelect,
  detail,
  detailLoading,
  detailError,
  onRetryDetail,
}: {
  value: unknown;
  loading: boolean;
  listError: boolean;
  page: number;
  onPage: (page: number) => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  detail?: ParentReportDetail;
  detailLoading: boolean;
  detailError: unknown;
  onRetryDetail: () => void;
}) {
  const { t: translate } = useTranslation();
  const rows = parentRecords(value);
  const root = asRecord(value);
  const total = root ? parentNumber(root, 'total') ?? rows.length : rows.length;
  return <div className={styles.reportGrid}>
    <WorkspaceSection title={translate("learning:reports.title")} count={total} className={styles.reportList}>
      <AdvisingPagination label={translate("learning:reports.pages")} page={page} total={total} onPage={onPage}/>
      {loading ? <p role="status">{translate("learning:reports.loadingList")}</p> : null}
      {!loading && !listError && rows.length === 0 ? <div className={shared.emptyState}><FileText size={42} aria-hidden="true"/><strong>{translate("learning:reports.parentNone")}</strong><span>{translate("learning:reports.parentNoneHelp")}</span></div> : null}
      {rows.length ? <div className={styles.reportRows}>{rows.map((row, index) => {
        const reportId = parentNumber(row, 'reportId');
        const title = parentText(row, 'title') || (parentText(row, 'reportType') ? parentLabel(parentText(row, 'reportType')) : undefined) || translate("learning:reports.report");
        const date = reportDate(parentText(row, 'publishedAt'));
        return <button
          type="button"
          key={reportId ?? index}
          className={styles.reportRow}
          data-selected={reportId != null && reportId === selectedId || undefined}
          aria-pressed={reportId != null && reportId === selectedId}
          disabled={reportId == null}
          onClick={() => reportId != null && onSelect(reportId)}
        >
          <span className={styles.iconTile}><FileText size={20} aria-hidden="true"/></span>
          <span><strong>{title}</strong><small>{date || translate("learning:reports.publishedReport")}</small></span>
        </button>;
      })}</div> : null}
      <p className={styles.reportNote}><ShieldCheck size={17} aria-hidden="true"/>{translate("learning:reports.parentVisibility")}</p>
    </WorkspaceSection>
    <WorkspaceSection title={detail?.reportType ? parentLabel(detail.reportType) : translate("operations:reportDetail")} className={styles.reportDetail} meta={detail ? <button type="button" className={styles.iconButton} onClick={() => onSelect(null)} aria-label={translate("learning:reports.close")}><X size={18} aria-hidden="true"/></button> : null}>
      {detailLoading ? <p role="status">{translate("learning:reports.loading")}</p> : null}
      {detailError ? <div role="alert" className={shared.conflictNotice}><p>{advisingErrorMessage(detailError, translate("learning:reports.failed"))}</p><button type="button" className={shared.secondary} onClick={onRetryDetail}>{translate("common:actions.retry")}</button></div> : null}
      {!selectedId && !detailLoading ? <div className={`${shared.emptyState} ${styles.detailEmpty}`}><FileText size={48} aria-hidden="true"/><strong>{translate("learning:reports.select")}</strong><span>{translate("learning:reports.selectHelp")}</span></div> : null}
      {detail ? <article className={styles.reportArticle}>
        <header>
          <span className={styles.reportHeroIcon}><FileText size={26} aria-hidden="true"/></span>
          <div><h3>{parentLabel(detail.reportType || translate("learning:reports.report"))}</h3>{detail.publishedAt ? <p><CalendarDays size={16} aria-hidden="true"/>{reportDate(detail.publishedAt)}</p> : null}</div>
          <AdvisingBadge kind="status" value="PUBLISHED" label={translate("common:status.PUBLISHED")}/>
        </header>
        {detail.overallSummary ? <div className={styles.reportSummary}><Lightbulb size={21} aria-hidden="true"/><p>{detail.overallSummary}</p></div> : null}
        <dl className={styles.reportFacts}>{DETAIL_FIELDS.flatMap(({key, icon: Icon}) => {
          const text = detail[key];
          return typeof text === 'string' && text.trim() ? [<div key={key}><span className={styles.iconTile}><Icon size={20} aria-hidden="true"/></span><div><dt>{recordFieldLabel(key)}</dt><dd>{text}</dd></div></div>] : [];
        })}</dl>
      </article> : null}
    </WorkspaceSection>
  </div>;
}
