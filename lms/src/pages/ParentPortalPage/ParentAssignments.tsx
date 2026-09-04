import {RichTextEditor} from '@/components/RichTextEditor';
import {formatUtcTimestamp} from '@/utils/datetime';
import {parentLabel, parentNumber, parentRecords, parentText} from './parentPresentation';
import styles from './index.module.scss';

/** Render only the parent contract's released result and student-visible feedback. */
export function ParentAssignments({value}: {value: unknown}) {
  const assignments = parentRecords(value);
  if (!assignments.length) return <p className={styles.meta}>No assignments are available yet.</p>;
  return <div className={styles.assignmentList}>{assignments.map((assignment, index) => {
    const title = parentText(assignment, 'title') || 'Assignment';
    const status = parentText(assignment, 'submissionStatus');
    const score = parentNumber(assignment, 'releasedScore');
    const points = parentNumber(assignment, 'pointsPossible');
    const feedback = parentText(assignment, 'studentVisibleFeedback');
    const dates = [
      ['Due', parentText(assignment, 'deadline')],
      ['Submitted', parentText(assignment, 'submittedAt')],
      ['Grade released', parentText(assignment, 'gradeReleasedAt')],
    ];
    return <article key={parentNumber(assignment, 'assignmentId') ?? index} aria-label={title} className={styles.assignmentRecord}>
      <div className={styles.rowHeading}><div><h3>{title}</h3><p>{parentText(assignment, 'courseTitle')}</p></div></div>
      <dl className={styles.assignmentFacts}>
        <div><dt>Submission</dt><dd>{status ? parentLabel(status) : 'Not provided'}</dd></div>
        <div><dt>Released score</dt><dd>{score == null ? 'Not released' : `${score}${points == null ? '' : ` / ${points}`}`}</dd></div>
        {dates.map(([label, timestamp]) => timestamp ? <div key={label}><dt>{label}</dt><dd>{formatUtcTimestamp(timestamp)}</dd></div> : null)}
      </dl>
      {feedback ? <div className={styles.assignmentFeedback}><strong>Instructor feedback</strong><RichTextEditor content={feedback} disabled displayOnly showToolbar={false} ariaLabel={`Feedback for ${title}`}/></div> : null}
    </article>;
  })}</div>;
}
