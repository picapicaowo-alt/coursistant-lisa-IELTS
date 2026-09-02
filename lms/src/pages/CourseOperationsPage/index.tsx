import React, {useState} from 'react';
import {Link, Navigate, useParams} from 'react-router-dom';
import {Field, OperationCard} from '@/components/OperationCard';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {advisorApiService} from '@/apis/services/advisor-api';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {ATTENDANCE_STATUSES, SCHEDULE_DECISIONS, SCHEDULE_REQUEST_TYPES} from '@/apis';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import {canAccessCourseOperations} from '@/utils/roleCapabilities';
import styles from './index.module.scss';

type Section = 'occurrences' | 'attendance' | 'reports' | 'discussion' | 'content' | 'enrolment';
type CourseReportType = '' | 'MID_TERM' | 'FINAL';

const positive = (value: string): number => Number(value);
const validId = (value: string): boolean => Number.isInteger(Number(value)) && Number(value) > 0;

const CourseOperationsPage: React.FC = () => {
  const {courseId} = useParams();
  const id = Number(courseId);
  const access = useCourseAccess(Number.isInteger(id) ? id : null);
  const {user} = useRequiredAuth();
  const platformAdmin = user.role === 'SYSTEM_ADMIN';
  const systemAdmin = user.role === 'SYSTEM_ADMIN';
  const staff = canAccessCourseOperations(user, access.courseRole);
  const [section, setSection] = useState<Section>('occurrences');
  const [occurrenceId, setOccurrenceId] = useState('');
  const [occurrence, setOccurrence] = useState({sessionId: '', weekId: '', date: '', start: '', end: '', expectedVersion: ''});
  const [range, setRange] = useState({from: '', to: '', includeHistory: false});
  const [attendance, setAttendance] = useState({studentUserId: '', status: 'PRESENT', version: ''});
  const [schedule, setSchedule] = useState({requestId: '', requestType: 'RESCHEDULE', date: '', start: '', end: '', reason: '', decision: 'APPROVE', version: '', rejectionReason: ''});
  const [report, setReport] = useState<{
    reportId: string;
    studentUserId: string;
    reportType: CourseReportType;
    status: string;
    version: string;
    summary: string;
    strengths: string;
    weaknesses: string;
    skills: string;
    suggestions: string;
  }>({reportId: '', studentUserId: '', reportType: '', status: '', version: '', summary: '', strengths: '', weaknesses: '', skills: '', suggestions: ''});
  const [discussion, setDiscussion] = useState({postId: '', attachmentId: '', body: '', reply: ''});
  const [links, setLinks] = useState({materialId: '', assignmentId: '', lectureId: ''});
  const [enrolment, setEnrolment] = useState({userId: '', userIds: '', emails: ''});

  const occurrenceValid = validId(occurrenceId);
  const reportValid = validId(report.reportId);
  const postValid = validId(discussion.postId);

  const previewDiscussion = async (): Promise<{status: string}> => {
    const popup = openPreviewWindow();
    if (!popup) throw new Error('Allow pop-ups to preview this attachment.');
    const blob = await courseOperationsApiService.previewDiscussionAttachment(id, positive(discussion.postId), positive(discussion.attachmentId));
    showBlobInPreviewWindow(popup, blob);
    return {status: 'Preview opened'};
  };

  if (!Number.isInteger(id) || id < 1) {
    return <main className={styles.page}><p role="alert">A valid course ID is required.</p><Link to="/course" className={styles.back}>Back to courses</Link></main>;
  }

  if (!platformAdmin && access.isLoading) {
    return <main className={styles.page}><p role="status">Checking course access…</p></main>;
  }

  if (!staff) return <Navigate to={access.membership ? `/course/${id}` : '/course'} replace/>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Course operations</p>
          <h1>{access.membership?.title || access.membership?.courseCode || `Course ${id}`}</h1>
          <p>Manage teaching delivery, learner progress, communication, and course resources.</p>
        </div>
        <Link to={`/course/${id}`} className={styles.back}>Back to course</Link>
      </header>

      <nav className={styles.shortcuts} aria-label="Course workspace shortcuts">
        <Link to={`/course/${id}`}>Course overview</Link>
        <Link to={`/course/${id}/schedule`}>Teaching schedule</Link>
        <Link to={`/course/${id}/events`}>Course events</Link>
        <Link to={`/roster/${id}`}>Learner roster</Link>
        <Link to={`/course/${id}/groups`}>Learning groups</Link>
        <Link to={`/course/${id}/grades`}>Grades</Link>
        {staff ? <Link to={`/course/${id}/assignments/new`}>Create assignment</Link> : null}
      </nav>

      <nav className={styles.tabs} aria-label="Course operation sections">
        {(['occurrences', 'attendance', 'reports', 'discussion', 'content', ...(systemAdmin ? ['enrolment'] : [])] as Section[]).map(item => (
          <button key={item} type="button" className={section === item ? styles.active : ''} onClick={() => setSection(item)}>{item}</button>
        ))}
      </nav>

      {section === 'occurrences' ? (
        <div className={styles.grid}>
          <OperationCard title="Session occurrences" description="Load generated and manually created occurrences in a date range." actionLabel="Load occurrences" onRun={() => courseOperationsApiService.listSessionOccurrences(id, {from: range.from || undefined, to: range.to || undefined, includeHistory: range.includeHistory})}>
            <Field label="From"><EnglishDateInput value={range.from} onChangeValue={from => setRange(current => ({...current, from}))}/></Field>
            <Field label="To"><EnglishDateInput value={range.to} onChangeValue={to => setRange(current => ({...current, to}))}/></Field>
            <Field label="History"><select value={String(range.includeHistory)} onChange={change => setRange(current => ({...current, includeHistory: change.target.value === 'true'}))}><option value="false">Upcoming only</option><option value="true">Include history</option></select></Field>
          </OperationCard>
          <OperationCard title="Occurrence detail" actionLabel="Load occurrence" disabled={!occurrenceValid} onRun={() => courseOperationsApiService.getSessionOccurrence(id, positive(occurrenceId))}>
            <Field label="Occurrence ID"><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
          </OperationCard>
          {staff ? <>
            <OperationCard title="Create occurrence" actionLabel="Create occurrence" disabled={!occurrence.date || !occurrence.start || !occurrence.end} onRun={() => courseOperationsApiService.createSessionOccurrence(id, {sessionId: occurrence.sessionId ? positive(occurrence.sessionId) : undefined, weekId: occurrence.weekId ? positive(occurrence.weekId) : undefined, occurrenceDate: occurrence.date, startTime: occurrence.start, endTime: occurrence.end})}>
              <Field label="Session ID"><input inputMode="numeric" value={occurrence.sessionId} onChange={change => setOccurrence(current => ({...current, sessionId: change.target.value}))}/></Field>
              <Field label="Week ID"><input inputMode="numeric" value={occurrence.weekId} onChange={change => setOccurrence(current => ({...current, weekId: change.target.value}))}/></Field>
              <Field label="Date"><EnglishDateInput value={occurrence.date} onChangeValue={date => setOccurrence(current => ({...current, date}))}/></Field>
              <Field label="Start"><EnglishTimeInput value={occurrence.start} onChangeValue={start => setOccurrence(current => ({...current, start}))}/></Field>
              <Field label="End"><EnglishTimeInput value={occurrence.end} onChangeValue={end => setOccurrence(current => ({...current, end}))}/></Field>
            </OperationCard>
            <OperationCard title="Generate occurrences" description="Generate occurrences from recurring course sessions." actionLabel="Generate" disabled={!range.from || !range.to} onRun={() => courseOperationsApiService.generateSessionOccurrences(id, {from: range.from, to: range.to, weekId: occurrence.weekId ? positive(occurrence.weekId) : undefined})}>
              <Field label="From"><EnglishDateInput value={range.from} onChangeValue={from => setRange(current => ({...current, from}))}/></Field>
              <Field label="To"><EnglishDateInput value={range.to} onChangeValue={to => setRange(current => ({...current, to}))}/></Field>
              <Field label="Week ID"><input inputMode="numeric" value={occurrence.weekId} onChange={change => setOccurrence(current => ({...current, weekId: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title="Reschedule occurrence" actionLabel="Reschedule" disabled={!occurrenceValid || !occurrence.expectedVersion || !occurrence.date} onRun={() => courseOperationsApiService.rescheduleSessionOccurrence(id, positive(occurrenceId), {expectedVersion: positive(occurrence.expectedVersion), occurrenceDate: occurrence.date, startTime: occurrence.start || undefined, endTime: occurrence.end || undefined, weekId: occurrence.weekId ? positive(occurrence.weekId) : undefined})}>
              <Field label="Occurrence ID"><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
              <Field label="Expected version"><input type="number" min="0" value={occurrence.expectedVersion} onChange={change => setOccurrence(current => ({...current, expectedVersion: change.target.value}))}/></Field>
              <Field label="New date"><EnglishDateInput value={occurrence.date} onChangeValue={date => setOccurrence(current => ({...current, date}))}/></Field>
              <Field label="Start"><EnglishTimeInput value={occurrence.start} onChangeValue={start => setOccurrence(current => ({...current, start}))}/></Field>
              <Field label="End"><EnglishTimeInput value={occurrence.end} onChangeValue={end => setOccurrence(current => ({...current, end}))}/></Field>
            </OperationCard>
            <OperationCard title="Cancel occurrence" description="Cancels this occurrence using its current version." actionLabel="Cancel occurrence" tone="danger" disabled={!occurrenceValid || !occurrence.expectedVersion} onRun={() => courseOperationsApiService.cancelSessionOccurrence(id, positive(occurrenceId), positive(occurrence.expectedVersion))}>
              <Field label="Occurrence ID"><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
              <Field label="Expected version"><input type="number" min="0" value={occurrence.expectedVersion} onChange={change => setOccurrence(current => ({...current, expectedVersion: change.target.value}))}/></Field>
            </OperationCard>
          </> : null}
          <OperationCard title="Occurrence schedule requests" actionLabel="Load requests" disabled={!occurrenceValid} onRun={() => courseOperationsApiService.listCourseScheduleRequests(id, positive(occurrenceId))}>
            <Field label="Occurrence ID"><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
          </OperationCard>
          <OperationCard title="Request schedule change" actionLabel="Submit request" disabled={!occurrenceValid} onRun={() => courseOperationsApiService.createCourseScheduleRequest(id, positive(occurrenceId), {requestType: schedule.requestType, proposedOccurrenceDate: schedule.date || undefined, proposedStartTime: schedule.start || undefined, proposedEndTime: schedule.end || undefined, reason: schedule.reason || undefined})}>
            <Field label="Occurrence ID"><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
            <Field label="Request type"><select value={schedule.requestType} onChange={change => setSchedule(current => ({...current, requestType: change.target.value}))}>{SCHEDULE_REQUEST_TYPES.map(type => <option key={type}>{type}</option>)}</select></Field>
            <Field label="Proposed date"><EnglishDateInput value={schedule.date} onChangeValue={date => setSchedule(current => ({...current, date}))}/></Field>
            <Field label="Proposed start"><EnglishTimeInput value={schedule.start} onChangeValue={start => setSchedule(current => ({...current, start}))}/></Field>
            <Field label="Proposed end"><EnglishTimeInput value={schedule.end} onChangeValue={end => setSchedule(current => ({...current, end}))}/></Field>
            <Field label="Reason"><textarea value={schedule.reason} onChange={change => setSchedule(current => ({...current, reason: change.target.value}))}/></Field>
          </OperationCard>
          {staff ? <OperationCard title="Instructor review" description="Review a schedule request associated with this course." actionLabel="Submit review" disabled={!validId(schedule.requestId) || !schedule.version} onRun={() => courseOperationsApiService.reviewCourseScheduleRequest(id, positive(schedule.requestId), {decision: schedule.decision, expectedVersion: positive(schedule.version), rejectionReason: schedule.rejectionReason || undefined})}>
            <Field label="Request ID"><input inputMode="numeric" value={schedule.requestId} onChange={change => setSchedule(current => ({...current, requestId: change.target.value}))}/></Field>
            <Field label="Decision"><select value={schedule.decision} onChange={change => setSchedule(current => ({...current, decision: change.target.value}))}>{SCHEDULE_DECISIONS.map(decision => <option key={decision}>{decision}</option>)}</select></Field>
            <Field label="Expected version"><input type="number" min="0" value={schedule.version} onChange={change => setSchedule(current => ({...current, version: change.target.value}))}/></Field>
            <Field label="Rejection reason"><textarea value={schedule.rejectionReason} onChange={change => setSchedule(current => ({...current, rejectionReason: change.target.value}))}/></Field>
          </OperationCard> : null}
        </div>
      ) : null}

      {section === 'attendance' ? (
        <div className={styles.grid}>
          {staff ? <OperationCard title="Student advising context" description="Instructor-safe profile and study-plan context for a student enrolled in this course." actionLabel="Load context" disabled={!validId(attendance.studentUserId)} onRun={() => advisorApiService.getInstructorStudentProfileContext(id, positive(attendance.studentUserId))}>
            <Field label="Student user ID"><input inputMode="numeric" value={attendance.studentUserId} onChange={change => setAttendance(current => ({...current, studentUserId: change.target.value}))}/></Field>
          </OperationCard> : null}
          {staff ? <>
            <OperationCard title="Attendance roster" actionLabel="Load roster" disabled={!occurrenceValid} onRun={() => courseOperationsApiService.getOccurrenceAttendance(id, positive(occurrenceId))}>
              <Field label="Occurrence ID"><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
            </OperationCard>
            <OperationCard title="Save attendance" description="Updates one learner at a time without inventing roster fields not present in the contract." actionLabel="Save attendance" disabled={!occurrenceValid || !validId(attendance.studentUserId) || !attendance.version} onRun={() => courseOperationsApiService.saveOccurrenceAttendance(id, positive(occurrenceId), {expectedAttendanceVersion: positive(attendance.version), entries: [{studentUserId: positive(attendance.studentUserId), status: attendance.status}]})}>
              <Field label="Occurrence ID"><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
              <Field label="Student user ID"><input inputMode="numeric" value={attendance.studentUserId} onChange={change => setAttendance(current => ({...current, studentUserId: change.target.value}))}/></Field>
              <Field label="Status"><select value={attendance.status} onChange={change => setAttendance(current => ({...current, status: change.target.value}))}>{ATTENDANCE_STATUSES.map(status => <option key={status}>{status}</option>)}</select></Field>
              <Field label="Attendance version"><input type="number" min="0" value={attendance.version} onChange={change => setAttendance(current => ({...current, version: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title="Synchronize roster" description="Adds current enrolled students to the occurrence attendance roster." actionLabel="Sync roster" disabled={!occurrenceValid} onRun={() => courseOperationsApiService.syncOccurrenceAttendanceRoster(id, positive(occurrenceId))}>
              <Field label="Occurrence ID"><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
            </OperationCard>
          </> : null}
        </div>
      ) : null}

      {section === 'reports' ? (
        <div className={styles.grid}>
          {staff ? <>
            <OperationCard title="Course student reports" actionLabel="Load reports" onRun={() => courseOperationsApiService.listCourseStudentReports(id, {studentUserId: report.studentUserId ? positive(report.studentUserId) : undefined, reportType: report.reportType || undefined, status: report.status || undefined, page: 0, size: 50})}>
              <Field label="Student user ID"><input inputMode="numeric" value={report.studentUserId} onChange={change => setReport(current => ({...current, studentUserId: change.target.value}))}/></Field>
              <Field label="Report type"><select value={report.reportType} onChange={change => setReport(current => ({...current, reportType: change.target.value as CourseReportType}))}><option value="">All</option><option value="MID_TERM">MID_TERM</option><option value="FINAL">FINAL</option></select></Field>
              <Field label="Status"><input value={report.status} onChange={change => setReport(current => ({...current, status: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title="Report detail" actionLabel="Load report" disabled={!reportValid} onRun={() => courseOperationsApiService.getCourseStudentReport(id, positive(report.reportId))}>
              <Field label="Report ID"><input inputMode="numeric" value={report.reportId} onChange={change => setReport(current => ({...current, reportId: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title="Create student report" actionLabel="Create report" disabled={!validId(report.studentUserId) || !report.reportType} onRun={() => courseOperationsApiService.createCourseStudentReport(id, {studentUserId: positive(report.studentUserId), reportType: report.reportType || undefined, overallSummary: report.summary || undefined, strengths: report.strengths || undefined, weaknesses: report.weaknesses || undefined, skillEvaluation: report.skills || undefined, improvementSuggestions: report.suggestions || undefined})}>
              <Field label="Student user ID"><input inputMode="numeric" value={report.studentUserId} onChange={change => setReport(current => ({...current, studentUserId: change.target.value}))}/></Field>
              <Field label="Report type"><select required value={report.reportType} onChange={change => setReport(current => ({...current, reportType: change.target.value as CourseReportType}))}><option value="">Select report type</option><option value="MID_TERM">MID_TERM</option><option value="FINAL">FINAL</option></select></Field>
              <Field label="Overall summary"><textarea value={report.summary} onChange={change => setReport(current => ({...current, summary: change.target.value}))}/></Field>
              <Field label="Strengths"><textarea value={report.strengths} onChange={change => setReport(current => ({...current, strengths: change.target.value}))}/></Field>
              <Field label="Weaknesses"><textarea value={report.weaknesses} onChange={change => setReport(current => ({...current, weaknesses: change.target.value}))}/></Field>
              <Field label="Skill evaluation"><textarea value={report.skills} onChange={change => setReport(current => ({...current, skills: change.target.value}))}/></Field>
              <Field label="Improvement suggestions"><textarea value={report.suggestions} onChange={change => setReport(current => ({...current, suggestions: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title="Update student report" actionLabel="Save report" disabled={!reportValid || !report.version} onRun={() => courseOperationsApiService.updateCourseStudentReport(id, positive(report.reportId), {expectedVersion: positive(report.version), reportType: report.reportType || undefined, overallSummary: report.summary || undefined, strengths: report.strengths || undefined, weaknesses: report.weaknesses || undefined, skillEvaluation: report.skills || undefined, improvementSuggestions: report.suggestions || undefined})}>
              <Field label="Report ID"><input inputMode="numeric" value={report.reportId} onChange={change => setReport(current => ({...current, reportId: change.target.value}))}/></Field>
              <Field label="Expected version"><input type="number" min="0" value={report.version} onChange={change => setReport(current => ({...current, version: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title="Publish student report" description="Publishes the current report version to the student, parent, and advisor views." actionLabel="Publish report" disabled={!reportValid || !report.version} onRun={() => courseOperationsApiService.publishCourseStudentReport(id, positive(report.reportId), positive(report.version))}>
              <Field label="Report ID"><input inputMode="numeric" value={report.reportId} onChange={change => setReport(current => ({...current, reportId: change.target.value}))}/></Field>
              <Field label="Expected version"><input type="number" min="0" value={report.version} onChange={change => setReport(current => ({...current, version: change.target.value}))}/></Field>
            </OperationCard>
          </> : null}
        </div>
      ) : null}

      {section === 'discussion' ? (
        <div className={styles.grid}>
          <OperationCard title="Discussion posts" actionLabel="Load posts" onRun={() => courseOperationsApiService.listDiscussionPosts(id)}/>
          <OperationCard title="Create discussion post" actionLabel="Post" disabled={!discussion.body.trim()} onRun={() => courseOperationsApiService.createDiscussionPost(id, discussion.body)}>
            <Field label="Post"><textarea value={discussion.body} onChange={change => setDiscussion(current => ({...current, body: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title="Discussion detail" actionLabel="Load post" disabled={!postValid} onRun={() => courseOperationsApiService.getDiscussionPost(id, positive(discussion.postId))}>
            <Field label="Post ID"><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title="Replies" actionLabel="Load replies" disabled={!postValid} onRun={() => courseOperationsApiService.listDiscussionReplies(id, positive(discussion.postId))}>
            <Field label="Post ID"><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title="Reply" actionLabel="Send reply" disabled={!postValid || !discussion.reply.trim()} onRun={() => courseOperationsApiService.createDiscussionReply(id, positive(discussion.postId), discussion.reply)}>
            <Field label="Post ID"><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
            <Field label="Reply"><textarea value={discussion.reply} onChange={change => setDiscussion(current => ({...current, reply: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title="Discussion attachments" actionLabel="Load attachments" disabled={!postValid} onRun={() => courseOperationsApiService.listDiscussionAttachments(id, positive(discussion.postId))}>
            <Field label="Post ID"><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title="Preview attachment" actionLabel="Open preview" disabled={!postValid || !validId(discussion.attachmentId)} onRun={previewDiscussion}>
            <Field label="Post ID"><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
            <Field label="Attachment ID"><input inputMode="numeric" value={discussion.attachmentId} onChange={change => setDiscussion(current => ({...current, attachmentId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title="Download attachment" actionLabel="Download" disabled={!postValid || !validId(discussion.attachmentId)} onRun={async () => { const blob = await courseOperationsApiService.downloadDiscussionAttachment(id, positive(discussion.postId), positive(discussion.attachmentId)); saveBlob(blob, `discussion-attachment-${discussion.attachmentId}`); return {status: 'Downloaded'}; }}>
            <Field label="Post ID"><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
            <Field label="Attachment ID"><input inputMode="numeric" value={discussion.attachmentId} onChange={change => setDiscussion(current => ({...current, attachmentId: change.target.value}))}/></Field>
          </OperationCard>
        </div>
      ) : null}

      {section === 'content' ? (
        <div className={styles.grid}>
          <OperationCard title="Assignments" description="Review the assignments available in this course." actionLabel="Load assignments" onRun={() => assignmentApiService.listAssignments(id)}/>
          <OperationCard title="Assignment attachment manifest" description="Loads every assignment attachment currently registered for this course." actionLabel="Load attachment manifest" onRun={() => assignmentApiService.listAssignmentAttachmentManifest(id)}/>
          <OperationCard title="Material relationships" actionLabel="Load links" disabled={!validId(links.materialId)} onRun={() => courseOperationsApiService.getMaterialLinks(id, positive(links.materialId))}>
            <Field label="Material ID"><input inputMode="numeric" value={links.materialId} onChange={change => setLinks(current => ({...current, materialId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title="Assignment materials" actionLabel="Load materials" disabled={!validId(links.assignmentId)} onRun={() => courseOperationsApiService.listAssignmentMaterials(id, positive(links.assignmentId))}>
            <Field label="Assignment ID"><input inputMode="numeric" value={links.assignmentId} onChange={change => setLinks(current => ({...current, assignmentId: change.target.value}))}/></Field>
          </OperationCard>
          {staff ? <>
            <OperationCard title="Attach material to assignment" actionLabel="Attach" disabled={!validId(links.materialId) || !validId(links.assignmentId)} onRun={() => courseOperationsApiService.attachMaterialToAssignment(id, positive(links.materialId), positive(links.assignmentId))}>
              <Field label="Material ID"><input inputMode="numeric" value={links.materialId} onChange={change => setLinks(current => ({...current, materialId: change.target.value}))}/></Field>
              <Field label="Assignment ID"><input inputMode="numeric" value={links.assignmentId} onChange={change => setLinks(current => ({...current, assignmentId: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title="Detach material from assignment" actionLabel="Detach" tone="danger" disabled={!validId(links.materialId) || !validId(links.assignmentId)} onRun={() => courseOperationsApiService.detachMaterialFromAssignment(id, positive(links.materialId), positive(links.assignmentId))}>
              <Field label="Material ID"><input inputMode="numeric" value={links.materialId} onChange={change => setLinks(current => ({...current, materialId: change.target.value}))}/></Field>
              <Field label="Assignment ID"><input inputMode="numeric" value={links.assignmentId} onChange={change => setLinks(current => ({...current, assignmentId: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title="Attach material to lecture" actionLabel="Attach" disabled={!validId(links.materialId) || !validId(links.lectureId)} onRun={() => courseOperationsApiService.attachMaterialToLecture(id, positive(links.materialId), positive(links.lectureId))}>
              <Field label="Material ID"><input inputMode="numeric" value={links.materialId} onChange={change => setLinks(current => ({...current, materialId: change.target.value}))}/></Field>
              <Field label="Lecture ID"><input inputMode="numeric" value={links.lectureId} onChange={change => setLinks(current => ({...current, lectureId: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title="Detach material from lecture" actionLabel="Detach" tone="danger" disabled={!validId(links.materialId) || !validId(links.lectureId)} onRun={() => courseOperationsApiService.detachMaterialFromLecture(id, positive(links.materialId), positive(links.lectureId))}>
              <Field label="Material ID"><input inputMode="numeric" value={links.materialId} onChange={change => setLinks(current => ({...current, materialId: change.target.value}))}/></Field>
              <Field label="Lecture ID"><input inputMode="numeric" value={links.lectureId} onChange={change => setLinks(current => ({...current, lectureId: change.target.value}))}/></Field>
            </OperationCard>
          </> : null}
        </div>
      ) : null}

      {section === 'enrolment' && systemAdmin ? (
        <div className={styles.grid}>
          <OperationCard title="Admin enrolment" actionLabel="Enrol user" disabled={!validId(enrolment.userId)} onRun={() => courseOperationsApiService.adminEnroll(id, positive(enrolment.userId))}>
            <Field label="User ID"><input inputMode="numeric" value={enrolment.userId} onChange={change => setEnrolment(current => ({...current, userId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title="Batch enrolment" description="Accepts comma-separated user IDs and email addresses." actionLabel="Enrol batch" disabled={!enrolment.userIds.trim() && !enrolment.emails.trim()} onRun={() => courseOperationsApiService.adminEnrollBatch(id, {userIds: enrolment.userIds.split(',').map(value => Number(value.trim())).filter(Number.isInteger), emails: enrolment.emails.split(',').map(value => value.trim()).filter(Boolean)})}>
            <Field label="User IDs"><textarea value={enrolment.userIds} onChange={change => setEnrolment(current => ({...current, userIds: change.target.value}))}/></Field>
            <Field label="Emails"><textarea value={enrolment.emails} onChange={change => setEnrolment(current => ({...current, emails: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title="Deactivate enrolment" actionLabel="Deactivate" tone="danger" disabled={!validId(enrolment.userId)} onRun={() => courseOperationsApiService.adminDeactivateEnrollment(id, positive(enrolment.userId))}>
            <Field label="User ID"><input inputMode="numeric" value={enrolment.userId} onChange={change => setEnrolment(current => ({...current, userId: change.target.value}))}/></Field>
          </OperationCard>
        </div>
      ) : null}
    </main>
  );
};

export default CourseOperationsPage;
