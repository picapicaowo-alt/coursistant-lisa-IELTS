import {useTranslation} from 'react-i18next';
import { FileText } from "lucide-react";
import { RecordSummaryList } from "@/components/RecordSummaryList";
import { asRecord } from "@/components/RecordSummaryList/recordPresentation";
import {
  contractItems,
  contractRecordNumber,
} from "../AdvisorOperationsPage/advisorViewModels";
import styles from "./SupportPage.module.scss";

/** Course report links use only the returned report/course IDs, never their list index. */
export function SupportReportList({
  value,
  courseId,
  onOpen,
}: {
  value: unknown;
  courseId?: number;
  onOpen: (courseId: number, reportId: number) => void;
}) {
  const {t: translate} = useTranslation();
  return (
    <div className={styles.reportList}>
      {contractItems(value).map((value, index) => {
        const report = asRecord(value);
        const id = contractRecordNumber(report, "id");
        const subjectCourseId =
          contractRecordNumber(report, "courseId") ?? courseId;
        const title =
          typeof report?.title === "string" ? report.title : translate("learning:reports.publishedReport");
        const summary =
          typeof report?.overallSummary === "string"
            ? report.overallSummary
            : undefined;
        return (
          <article className={styles.reportRow} key={id ?? index}>
            <FileText size={22} aria-hidden="true" />
            <div>
              {id != null && subjectCourseId != null ? (
                <>
                  <button
                    type="button"
                    onClick={() => onOpen(subjectCourseId, id)}
                  >
                    {title}
                  </button>
                  {summary ? <p>{summary}</p> : null}
                </>
              ) : (
                <RecordSummaryList value={report} />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
