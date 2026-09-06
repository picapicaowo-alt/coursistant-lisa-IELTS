import {useTranslation} from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import {RichTextEditor} from '@/components/RichTextEditor';
import {formatUtcTimestamp} from '@/utils/datetime';
import {parentLabel, parentNumber, parentRecords, parentText} from './parentPresentation';
import styles from './index.module.scss';

/** Render only the parent contract's released result and student-visible feedback. */
export function ParentAssignments({value}: {value: unknown}) {
  const {t: translate} = useTranslation();
  const assignments = parentRecords(value);
  if (!assignments.length) return <p className={styles.meta}>{translate('learning:parentAssignments.empty')}</p>;
  return <div className={styles.assignmentList}>{assignments.map((assignment, index) => {
    const title = parentText(assignment, 'title') || translate("common:status.ASSIGNMENT");
    const status = parentText(assignment, 'submissionStatus');
    const score = parentNumber(assignment, 'releasedScore');
    const points = parentNumber(assignment, 'pointsPossible');
    const feedback = parentText(assignment, 'studentVisibleFeedback');
    const dates = [
      ['assessment:submission.due', parentText(assignment, 'deadline')],
      ['assessment:grading.submittedAt', parentText(assignment, 'submittedAt')],
      ['learning:parentAssignments.gradeReleased', parentText(assignment, 'gradeReleasedAt')],
    ];
    return <article key={parentNumber(assignment, 'assignmentId') ?? index} aria-label={title} className={styles.assignmentRecord}>
      <div className={styles.rowHeading}><div><h3>{title}</h3><p>{parentText(assignment, 'courseTitle')}</p></div></div>
      <dl className={styles.assignmentFacts}>
        <div><dt>{translate("detailWorkspace:assignmentReview.submission")}</dt><dd>{status ? parentLabel(status) : translate("common:feedback.notProvided")}</dd></div>
        <div><dt>{translate('learning:parentAssignments.releasedScore')}</dt><dd>{score == null ? translate("course:learning.notReleased") : `${formatNumber(score)}${points == null ? '' : ` / ${formatNumber(points)}`}`}</dd></div>
        {dates.map(([label, timestamp]) => timestamp ? <div key={label}><dt>{translate(label!)}</dt><dd>{formatUtcTimestamp(timestamp)}</dd></div> : null)}
      </dl>
      {feedback ? <div className={styles.assignmentFeedback}><strong>{translate("assessment:submission.instructorFeedback")}</strong><RichTextEditor content={feedback} disabled displayOnly showToolbar={false} ariaLabel={translate('learning:parentAssignments.feedbackFor', {title})}/></div> : null}
    </article>;
  })}</div>;
}
