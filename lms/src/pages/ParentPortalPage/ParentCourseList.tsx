import {AdvisingBadge} from '@/components/AdvisingBadge';
import {CourseIdentityCard} from '@/components/CourseIdentityCard';
import {CourseCardGrid} from '@/components/CourseIdentityCard/CourseCardGrid';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {formatPersonName} from '@/utils/personName';
import {parentDate, parentLabel, parentNumber, parentRecords, parentText, withoutFields} from './parentPresentation';
import styles from './index.module.scss';

export function ParentCourseList({value}: {value: unknown}) {
  const courses = parentRecords(value);
  if (!courses.length) return <RecordSummaryList value={value} emptyMessage="Courses will appear here when the student is enrolled."/>;
  return <CourseCardGrid>{courses.map((course, index) => {
    const title = parentText(course, 'title') || parentText(course, 'courseTitle') || parentText(course, 'courseCode') || 'Course';
    const instructor = formatPersonName({firstName: parentText(course, 'instructorFirstName'), middleName: parentText(course, 'instructorMiddleName'), lastName: parentText(course, 'instructorLastName')});
    const progress = parentNumber(course, 'progressPercent');
    const validProgress = progress != null && progress >= 0 && progress <= 100;
    const submitted = parentNumber(course, 'submittedAssignmentCount');
    const published = parentNumber(course, 'publishedAssignmentCount');
    const start = parentText(course, 'termStartDate');
    const end = parentText(course, 'termEndDate');
    const status = parentText(course, 'lifecycleStatus') || parentText(course, 'status');
    const details = withoutFields(course, ['title', 'courseTitle', 'courseCode', 'instructorFirstName', 'instructorMiddleName', 'instructorLastName', 'progressPercent', 'submittedAssignmentCount', 'publishedAssignmentCount', 'termStartDate', 'termEndDate', 'lifecycleStatus', 'status']);
    return <CourseIdentityCard key={parentNumber(course, 'courseId') ?? index} courseId={parentNumber(course, 'courseId') ?? index}
      title={title} code={parentText(course, 'courseCode')} instructor={instructor || undefined}
      status={status ? <AdvisingBadge kind="status" value={status} label={parentLabel(status)}/> : null}
      footer={Object.keys(details).some(key => !/Id$/.test(key)) ? <details className={styles.details}><summary>Course details</summary><RecordSummaryList value={details}/></details> : undefined}
    >
      {start || end ? <p className={styles.meta}>{start ? parentDate(start) : 'Start date not provided'} — {end ? parentDate(end) : 'End date not provided'}</p> : null}
      {validProgress ? <div className={styles.courseProgress}><div><span>Assignment progress</span><strong>{progress}%</strong></div><progress aria-label={`${title} assignment progress`} value={progress} max={100}/></div> : null}
      {submitted != null || published != null ? <p className={styles.meta}>{submitted != null ? `${submitted} submitted` : 'Submission count unavailable'}{published != null ? ` · ${published} published assignments` : ''}</p> : null}
    </CourseIdentityCard>;
  })}</CourseCardGrid>;
}
