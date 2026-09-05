import {useTranslation} from 'react-i18next';
import {LocalizedError} from '@/i18n/errors';
import {statusLabel} from '@/i18n/presentation';
import React, {useState} from 'react';
import {generatePath, Link, Navigate, useParams} from 'react-router-dom';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {Field, OperationCard} from '@/components/OperationCard';
import {EnglishDateInput} from '@/components/EnglishDateInput';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {advisorApiService} from '@/apis/services/advisor-api';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {ATTENDANCE_STATUSES} from '@/apis';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import {canAccessCourseOperations} from '@/utils/roleCapabilities';
import styles from './index.module.scss';
import {InstructorCourseOperations} from './InstructorCourseOperations';

type Section = 'occurrences' | 'attendance' | 'reports' | 'discussion' | 'content' | 'enrolment';
type CourseReportType = '' | 'MID_TERM' | 'FINAL';

const SECTION_LABELS: Record<Section, string> = {
  occurrences: 'operations:tabs.occurrences', attendance: 'operations:tabs.attendance',
  reports: 'operations:tabs.reports', discussion: 'course:learning.tabs.discussion',
  content: 'operations:tabs.content', enrolment: 'operations:tabs.enrolment',
};

const positive = (value: string): number => Number(value);
const validId = (value: string): boolean => Number.isInteger(Number(value)) && Number(value) > 0;

const LegacyCourseOperationsPage: React.FC = () => {
  const {t: translate} = useTranslation();
  const {courseId} = useParams();
  const id = Number(courseId);
  const access = useCourseAccess(Number.isInteger(id) ? id : null);
  const {user} = useRequiredAuth();
  const platformAdmin = user.role === 'SYSTEM_ADMIN';
  const systemAdmin = user.role === 'SYSTEM_ADMIN';
  const staff = canAccessCourseOperations(user, access.courseRole);
  const [section, setSection] = useState<Section>('occurrences');
  const [occurrenceId, setOccurrenceId] = useState('');

  const [range, setRange] = useState({from: '', to: '', includeHistory: false});
  const [attendance, setAttendance] = useState({studentUserId: '', status: 'PRESENT', version: ''});

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

  const previewDiscussion = async (): Promise<void> => {
    const popup = openPreviewWindow();
    if (!popup) throw new LocalizedError("operations:errors.attachmentPopups");
    const blob = await courseOperationsApiService.previewDiscussionAttachment(id, positive(discussion.postId), positive(discussion.attachmentId));
    showBlobInPreviewWindow(popup, blob);
  };

  if (!Number.isInteger(id) || id < 1) {
    return <main className={styles.page}><p role="alert">{translate("operations:validCourseRequired")}</p><Link to="/course" className={styles.back}>{translate("course:detail.backToCourses")}</Link></main>;
  }

  if (!platformAdmin && access.isLoading) {
    return <main className={styles.page}><p role="status">{translate("operations:checkingAccess")}</p></main>;
  }

  if (!staff) return <Navigate to={access.membership ? `/course/${id}` : '/course'} replace/>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{translate("course:catalogue.operations")}</p>
          <h1>{access.membership?.title || access.membership?.courseCode || translate('assistant:courseFallback', {id})}</h1>
          <p>{translate("operations:overviewHelp")}</p>
        </div>
        <Link to={APP_ROUTE_PATHS.course} className={styles.back}>{translate("course:detail.backToCourses")}</Link>
      </header>

      <nav className={styles.shortcuts} aria-label={translate("operations:shortcuts")}>
        <Link to={`/course/${id}`}>{translate("course:learning.overview")}</Link>
        <Link to={`/course/${id}/schedule`}>{translate("operations:teachingSchedule")}</Link>
        <Link to={`/course/${id}/events`}>{translate("operations:courseEvents")}</Link>
        {systemAdmin || access.isInstructor ? <Link to={generatePath(APP_ROUTE_PATHS.rosterCourseId, {courseId: String(id)})}>{translate("operations:learnerRoster")}</Link> : null}
        <Link to={`/course/${id}/groups`}>{translate("operations:learningGroups")}</Link>
        <Link to={`/course/${id}/grades`}>{translate("course:grades.label")}</Link>
        {staff ? <Link to={`/course/${id}/assignments/new`}>{translate("operations:createAssignment")}</Link> : null}
      </nav>

      <nav className={styles.tabs} aria-label={translate("operations:sections")}>
        {(['occurrences', 'attendance', 'reports', 'discussion', 'content', ...(systemAdmin ? ['enrolment'] : [])] as Section[]).map(item => (
          <button key={item} type="button" className={section === item ? styles.active : ''} onClick={() => setSection(item)}>{translate(SECTION_LABELS[item])}</button>
        ))}
      </nav>

      {section === 'occurrences' ? (
        <div className={styles.grid}>
          <OperationCard title={translate("operations:sessionOccurrences")} description={translate("operations:loadOccurrencesHelp")} actionLabel={translate("operations:loadOccurrences")} onRun={() => courseOperationsApiService.listSessionOccurrences(id, {from: range.from || undefined, to: range.to || undefined, includeHistory: range.includeHistory})}>
            <Field label={translate("operations:from")}><EnglishDateInput value={range.from} onChangeValue={from => setRange(current => ({...current, from}))}/></Field>
            <Field label={translate("operations:to")}><EnglishDateInput value={range.to} onChangeValue={to => setRange(current => ({...current, to}))}/></Field>
            <Field label={translate("operations:history")}><select value={String(range.includeHistory)} onChange={change => setRange(current => ({...current, includeHistory: change.target.value === 'true'}))}><option value="false">{translate("operations:upcomingOnly")}</option><option value="true">{translate("operations:includeHistory")}</option></select></Field>
          </OperationCard>
          <OperationCard title={translate("operations:occurrenceDetail")} actionLabel={translate("operations:loadOccurrence")} disabled={!occurrenceValid} onRun={() => courseOperationsApiService.getSessionOccurrence(id, positive(occurrenceId))}>
            <Field label={translate("operations:occurrenceId")}><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
          </OperationCard>
          <OperationCard title={translate("operations:occurrenceRequests")} actionLabel={translate("operations:loadRequests")} disabled={!occurrenceValid} onRun={() => courseOperationsApiService.listCourseScheduleRequests(id, positive(occurrenceId))}>
            <Field label={translate("operations:occurrenceId")}><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
          </OperationCard>
        </div>
      ) : null}

      {section === 'attendance' ? (
        <div className={styles.grid}>
          {staff ? <OperationCard title={translate("operations:studentContext")} description={translate("operations:studentContextHelp")} actionLabel={translate("operations:loadContext")} disabled={!validId(attendance.studentUserId)} onRun={() => advisorApiService.getInstructorStudentProfileContext(id, positive(attendance.studentUserId))}>
            <Field label={translate("common:admin.studentId")}><input inputMode="numeric" value={attendance.studentUserId} onChange={change => setAttendance(current => ({...current, studentUserId: change.target.value}))}/></Field>
          </OperationCard> : null}
          {staff ? <>
            <OperationCard title={translate("operations:attendanceRoster")} actionLabel={translate("operations:loadRoster")} disabled={!occurrenceValid} onRun={() => courseOperationsApiService.getOccurrenceAttendance(id, positive(occurrenceId))}>
              <Field label={translate("operations:occurrenceId")}><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
            </OperationCard>
            <OperationCard title={translate("operations:saveAttendance")} description={translate("operations:saveAttendanceHelp")} actionLabel={translate("operations:saveAttendance")} disabled={!occurrenceValid || !validId(attendance.studentUserId) || !attendance.version} onRun={() => courseOperationsApiService.saveOccurrenceAttendance(id, positive(occurrenceId), {expectedAttendanceVersion: positive(attendance.version), entries: [{studentUserId: positive(attendance.studentUserId), status: attendance.status}]})}>
              <Field label={translate("operations:occurrenceId")}><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
              <Field label={translate("common:admin.studentId")}><input inputMode="numeric" value={attendance.studentUserId} onChange={change => setAttendance(current => ({...current, studentUserId: change.target.value}))}/></Field>
              <Field label={translate("common:fields.status")}><select value={attendance.status} onChange={change => setAttendance(current => ({...current, status: change.target.value}))}>{ATTENDANCE_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></Field>
              <Field label={translate("operations:attendanceVersion")}><input type="number" min="0" value={attendance.version} onChange={change => setAttendance(current => ({...current, version: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title={translate("operations:synchronizeRoster")} description={translate("operations:syncRosterHelp")} actionLabel={translate("operations:syncRoster")} disabled={!occurrenceValid} onRun={() => courseOperationsApiService.syncOccurrenceAttendanceRoster(id, positive(occurrenceId))}>
              <Field label={translate("operations:occurrenceId")}><input inputMode="numeric" value={occurrenceId} onChange={change => setOccurrenceId(change.target.value)}/></Field>
            </OperationCard>
          </> : null}
        </div>
      ) : null}

      {section === 'reports' ? (
        <div className={styles.grid}>
          {staff ? <>
            <OperationCard title={translate("operations:courseStudentReports")} actionLabel={translate("operations:loadReports")} onRun={() => courseOperationsApiService.listCourseStudentReports(id, {studentUserId: report.studentUserId ? positive(report.studentUserId) : undefined, reportType: report.reportType || undefined, status: report.status || undefined, page: 0, size: 50})}>
              <Field label={translate("common:admin.studentId")}><input inputMode="numeric" value={report.studentUserId} onChange={change => setReport(current => ({...current, studentUserId: change.target.value}))}/></Field>
              <Field label={translate("operations:reportType")}><select value={report.reportType} onChange={change => setReport(current => ({...current, reportType: change.target.value as CourseReportType}))}><option value="">{translate("course:detail.filterAll")}</option><option value="MID_TERM">{translate('operations:midTermReport')}</option><option value="FINAL">{translate('operations:finalReport')}</option></select></Field>
              <Field label={translate("common:fields.status")}><input value={report.status} onChange={change => setReport(current => ({...current, status: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title={translate("operations:reportDetail")} actionLabel={translate("operations:loadReport")} disabled={!reportValid} onRun={() => courseOperationsApiService.getCourseStudentReport(id, positive(report.reportId))}>
              <Field label={translate("operations:reportId")}><input inputMode="numeric" value={report.reportId} onChange={change => setReport(current => ({...current, reportId: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title={translate("operations:createStudentReport")} actionLabel={translate("operations:createReport")} disabled={!validId(report.studentUserId) || !report.reportType} onRun={() => courseOperationsApiService.createCourseStudentReport(id, {studentUserId: positive(report.studentUserId), reportType: report.reportType || undefined, overallSummary: report.summary || undefined, strengths: report.strengths || undefined, weaknesses: report.weaknesses || undefined, skillEvaluation: report.skills || undefined, improvementSuggestions: report.suggestions || undefined})}>
              <Field label={translate("common:admin.studentId")}><input inputMode="numeric" value={report.studentUserId} onChange={change => setReport(current => ({...current, studentUserId: change.target.value}))}/></Field>
              <Field label={translate("operations:reportType")}><select required value={report.reportType} onChange={change => setReport(current => ({...current, reportType: change.target.value as CourseReportType}))}><option value="">{translate("operations:selectReportType")}</option><option value="MID_TERM">{translate('operations:midTermReport')}</option><option value="FINAL">{translate('operations:finalReport')}</option></select></Field>
              <Field label={translate("operations:overallSummary")}><textarea value={report.summary} onChange={change => setReport(current => ({...current, summary: change.target.value}))}/></Field>
              <Field label={translate("operations:strengths")}><textarea value={report.strengths} onChange={change => setReport(current => ({...current, strengths: change.target.value}))}/></Field>
              <Field label={translate("operations:weaknesses")}><textarea value={report.weaknesses} onChange={change => setReport(current => ({...current, weaknesses: change.target.value}))}/></Field>
              <Field label={translate("operations:skillEvaluation")}><textarea value={report.skills} onChange={change => setReport(current => ({...current, skills: change.target.value}))}/></Field>
              <Field label={translate("operations:improvementSuggestions")}><textarea value={report.suggestions} onChange={change => setReport(current => ({...current, suggestions: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title={translate("operations:updateStudentReport")} actionLabel={translate("operations:saveReport")} disabled={!reportValid || !report.version} onRun={() => courseOperationsApiService.updateCourseStudentReport(id, positive(report.reportId), {expectedVersion: positive(report.version), reportType: report.reportType || undefined, overallSummary: report.summary || undefined, strengths: report.strengths || undefined, weaknesses: report.weaknesses || undefined, skillEvaluation: report.skills || undefined, improvementSuggestions: report.suggestions || undefined})}>
              <Field label={translate("operations:reportId")}><input inputMode="numeric" value={report.reportId} onChange={change => setReport(current => ({...current, reportId: change.target.value}))}/></Field>
              <Field label={translate("operations:expectedVersion")}><input type="number" min="0" value={report.version} onChange={change => setReport(current => ({...current, version: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title={translate("operations:publishStudentReport")} description={translate("operations:publishReportHelp")} actionLabel={translate("operations:publishReport")} disabled={!reportValid || !report.version} onRun={() => courseOperationsApiService.publishCourseStudentReport(id, positive(report.reportId), positive(report.version))}>
              <Field label={translate("operations:reportId")}><input inputMode="numeric" value={report.reportId} onChange={change => setReport(current => ({...current, reportId: change.target.value}))}/></Field>
              <Field label={translate("operations:expectedVersion")}><input type="number" min="0" value={report.version} onChange={change => setReport(current => ({...current, version: change.target.value}))}/></Field>
            </OperationCard>
          </> : null}
        </div>
      ) : null}

      {section === 'discussion' ? (
        <div className={styles.grid}>
          <OperationCard title={translate("operations:discussionPosts")} actionLabel={translate("operations:loadPosts")} onRun={() => courseOperationsApiService.listDiscussionPosts(id)}/>
          <OperationCard title={translate("operations:createDiscussionPost")} actionLabel={translate("operations:post")} disabled={!discussion.body.trim()} onRun={() => courseOperationsApiService.createDiscussionPost(id, discussion.body)}>
            <Field label={translate("operations:post")}><textarea value={discussion.body} onChange={change => setDiscussion(current => ({...current, body: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title={translate("operations:discussionDetail")} actionLabel={translate("operations:loadPost")} disabled={!postValid} onRun={() => courseOperationsApiService.getDiscussionPost(id, positive(discussion.postId))}>
            <Field label={translate("operations:postId")}><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title={translate("operations:replies")} actionLabel={translate("operations:loadReplies")} disabled={!postValid} onRun={() => courseOperationsApiService.listDiscussionReplies(id, positive(discussion.postId))}>
            <Field label={translate("operations:postId")}><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title={translate("operations:reply")} actionLabel={translate("operations:sendReply")} disabled={!postValid || !discussion.reply.trim()} onRun={() => courseOperationsApiService.createDiscussionReply(id, positive(discussion.postId), discussion.reply)}>
            <Field label={translate("operations:postId")}><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
            <Field label={translate("operations:reply")}><textarea value={discussion.reply} onChange={change => setDiscussion(current => ({...current, reply: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title={translate("operations:discussionAttachments")} actionLabel={translate("operations:loadAttachments")} disabled={!postValid} onRun={() => courseOperationsApiService.listDiscussionAttachments(id, positive(discussion.postId))}>
            <Field label={translate("operations:postId")}><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title={translate("operations:previewAttachment")} actionLabel={translate("operations:openPreview")} disabled={!postValid || !validId(discussion.attachmentId)} successMessage={translate('operations:previewOpened')} onRun={previewDiscussion}>
            <Field label={translate("operations:postId")}><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
            <Field label={translate("operations:attachmentId")}><input inputMode="numeric" value={discussion.attachmentId} onChange={change => setDiscussion(current => ({...current, attachmentId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard successMessage={translate('operations:downloaded')} title={translate("operations:downloadAttachment")} actionLabel={translate("common:actions.download")} disabled={!postValid || !validId(discussion.attachmentId)} onRun={async () => { const blob = await courseOperationsApiService.downloadDiscussionAttachment(id, positive(discussion.postId), positive(discussion.attachmentId)); saveBlob(blob, translate('operations:attachmentFilename', {id: discussion.attachmentId})); }}>
            <Field label={translate("operations:postId")}><input inputMode="numeric" value={discussion.postId} onChange={change => setDiscussion(current => ({...current, postId: change.target.value}))}/></Field>
            <Field label={translate("operations:attachmentId")}><input inputMode="numeric" value={discussion.attachmentId} onChange={change => setDiscussion(current => ({...current, attachmentId: change.target.value}))}/></Field>
          </OperationCard>
        </div>
      ) : null}

      {section === 'content' ? (
        <div className={styles.grid}>
          <OperationCard title={translate("course:detail.assignments")} description={translate("operations:assignmentsHelp")} actionLabel={translate("operations:loadAssignments")} onRun={() => assignmentApiService.listAssignments(id)}/>
          <OperationCard title={translate("operations:attachmentManifest")} description={translate("operations:attachmentManifestHelp")} actionLabel={translate("operations:loadAttachmentManifest")} onRun={() => assignmentApiService.listAssignmentAttachmentManifest(id)}/>
          <OperationCard title={translate("operations:materialRelationships")} actionLabel={translate("operations:loadLinks")} disabled={!validId(links.materialId)} onRun={() => courseOperationsApiService.getMaterialLinks(id, positive(links.materialId))}>
            <Field label={translate("operations:materialId")}><input inputMode="numeric" value={links.materialId} onChange={change => setLinks(current => ({...current, materialId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title={translate("operations:assignmentMaterials")} actionLabel={translate("operations:loadMaterials")} disabled={!validId(links.assignmentId)} onRun={() => courseOperationsApiService.listAssignmentMaterials(id, positive(links.assignmentId))}>
            <Field label={translate("common:admin.assignmentId")}><input inputMode="numeric" value={links.assignmentId} onChange={change => setLinks(current => ({...current, assignmentId: change.target.value}))}/></Field>
          </OperationCard>
          {staff ? <>
            <OperationCard title={translate("operations:attachAssignment")} actionLabel={translate("operations:attach")} disabled={!validId(links.materialId) || !validId(links.assignmentId)} onRun={() => courseOperationsApiService.attachMaterialToAssignment(id, positive(links.materialId), positive(links.assignmentId))}>
              <Field label={translate("operations:materialId")}><input inputMode="numeric" value={links.materialId} onChange={change => setLinks(current => ({...current, materialId: change.target.value}))}/></Field>
              <Field label={translate("common:admin.assignmentId")}><input inputMode="numeric" value={links.assignmentId} onChange={change => setLinks(current => ({...current, assignmentId: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title={translate("operations:detachAssignment")} actionLabel={translate("operations:detach")} tone="danger" disabled={!validId(links.materialId) || !validId(links.assignmentId)} onRun={() => courseOperationsApiService.detachMaterialFromAssignment(id, positive(links.materialId), positive(links.assignmentId))}>
              <Field label={translate("operations:materialId")}><input inputMode="numeric" value={links.materialId} onChange={change => setLinks(current => ({...current, materialId: change.target.value}))}/></Field>
              <Field label={translate("common:admin.assignmentId")}><input inputMode="numeric" value={links.assignmentId} onChange={change => setLinks(current => ({...current, assignmentId: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title={translate("operations:attachLecture")} actionLabel={translate("operations:attach")} disabled={!validId(links.materialId) || !validId(links.lectureId)} onRun={() => courseOperationsApiService.attachMaterialToLecture(id, positive(links.materialId), positive(links.lectureId))}>
              <Field label={translate("operations:materialId")}><input inputMode="numeric" value={links.materialId} onChange={change => setLinks(current => ({...current, materialId: change.target.value}))}/></Field>
              <Field label={translate("operations:lectureId")}><input inputMode="numeric" value={links.lectureId} onChange={change => setLinks(current => ({...current, lectureId: change.target.value}))}/></Field>
            </OperationCard>
            <OperationCard title={translate("operations:detachLecture")} actionLabel={translate("operations:detach")} tone="danger" disabled={!validId(links.materialId) || !validId(links.lectureId)} onRun={() => courseOperationsApiService.detachMaterialFromLecture(id, positive(links.materialId), positive(links.lectureId))}>
              <Field label={translate("operations:materialId")}><input inputMode="numeric" value={links.materialId} onChange={change => setLinks(current => ({...current, materialId: change.target.value}))}/></Field>
              <Field label={translate("operations:lectureId")}><input inputMode="numeric" value={links.lectureId} onChange={change => setLinks(current => ({...current, lectureId: change.target.value}))}/></Field>
            </OperationCard>
          </> : null}
        </div>
      ) : null}

      {section === 'enrolment' && systemAdmin ? (
        <div className={styles.grid}>
          <OperationCard title={translate("operations:adminEnrolment")} actionLabel={translate("operations:enrolUser")} disabled={!validId(enrolment.userId)} onRun={() => courseOperationsApiService.adminEnroll(id, positive(enrolment.userId))}>
            <Field label={translate("common:admin.userId")}><input inputMode="numeric" value={enrolment.userId} onChange={change => setEnrolment(current => ({...current, userId: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title={translate("operations:batchEnrolment")} description={translate("operations:batchEnrolmentHelp")} actionLabel={translate("operations:enrolBatch")} disabled={!enrolment.userIds.trim() && !enrolment.emails.trim()} onRun={() => courseOperationsApiService.adminEnrollBatch(id, {userIds: enrolment.userIds.split(',').map(value => Number(value.trim())).filter(Number.isInteger), emails: enrolment.emails.split(',').map(value => value.trim()).filter(Boolean)})}>
            <Field label={translate("operations:userIds")}><textarea value={enrolment.userIds} onChange={change => setEnrolment(current => ({...current, userIds: change.target.value}))}/></Field>
            <Field label={translate("operations:emails")}><textarea value={enrolment.emails} onChange={change => setEnrolment(current => ({...current, emails: change.target.value}))}/></Field>
          </OperationCard>
          <OperationCard title={translate("operations:deactivateEnrolment")} actionLabel={translate("operations:deactivate")} tone="danger" disabled={!validId(enrolment.userId)} onRun={() => courseOperationsApiService.adminDeactivateEnrollment(id, positive(enrolment.userId))}>
            <Field label={translate("common:admin.userId")}><input inputMode="numeric" value={enrolment.userId} onChange={change => setEnrolment(current => ({...current, userId: change.target.value}))}/></Field>
          </OperationCard>
        </div>
      ) : null}
    </main>
  );
};

// Keep existing TA/admin workflows and their course-level capability boundaries intact.
const CourseOperationsPage: React.FC = () => {
  const {t: translate} = useTranslation();
  const {courseId} = useParams();
  const id = Number(courseId);
  const access = useCourseAccess(Number.isSafeInteger(id) && id > 0 ? id : null);
  return access.isInstructor && id > 0
    ? <InstructorCourseOperations key={id} courseId={id} title={access.membership?.title || access.membership?.courseCode || translate('assistant:courseFallback', {id})}/>
    : <LegacyCourseOperationsPage/>;
};

export default CourseOperationsPage;
