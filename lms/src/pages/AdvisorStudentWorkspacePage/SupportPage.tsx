import React, {useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisorConversationMessageViews, contractItems, contractRecordNumber} from '../AdvisorOperationsPage/advisorViewModels';
import styles from '../advising/advising.module.scss';

const positiveId = (value: string): boolean => Number.isInteger(Number(value)) && Number(value) > 0;

const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const SupportPage: React.FC = () => {
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const queryClient = useQueryClient();
  const [messageBody, setMessageBody] = useState('');
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [hoursForm, setHoursForm] = useState({purchasedMinutes: '', expectedVersion: '', reason: ''});
  const [advanced, setAdvanced] = useState({taskId: '', taskVersion: '', feedback: '', occurrenceId: '', reportId: ''});

  const hub = useQuery({queryKey: ['advisor', 'student-hub', id], queryFn: async () => unwrapData(await advisorApiService.getStudentHub(id), 'advisorStudentHub'), enabled: Number.isInteger(id), retry: false});
  const studentReports = useQuery({queryKey: ['advisor', 'student-reports', id], queryFn: async () => unwrapData(await advisorApiService.listStudentPublishedReports(id), 'advisorStudentReports'), enabled: Number.isInteger(id), retry: false});
  const attendance = useQuery({queryKey: ['advisor', 'student-attendance', id], queryFn: async () => unwrapData(await courseOperationsApiService.getAdvisorStudentAttendance(id), 'advisorStudentAttendance'), enabled: Number.isInteger(id), retry: false});
  const courses = useQuery({queryKey: ['advisor', 'student-courses', id], queryFn: async () => unwrapData(await advisorApiService.listStudentCourses(id), 'advisorStudentCourses'), enabled: Number.isInteger(id), retry: false});
  const messages = useQuery({queryKey: ['advisor', 'student-conversation', id], queryFn: async () => unwrapData(await advisorApiService.listConversationMessages(id), 'advisorConversationMessages'), enabled: Number.isInteger(id), retry: false});
  const courseId = Number(selectedCourseId);
  const hours = useQuery({queryKey: ['advisor', 'student-course-hours', id, courseId], queryFn: async () => unwrapData(await courseOperationsApiService.getAdvisorStudentCourseHours(id, courseId), 'advisorStudentCourseHours'), enabled: positiveId(selectedCourseId), retry: false});
  const courseReports = useQuery({queryKey: ['advisor', 'student-course-reports', id, courseId], queryFn: async () => unwrapData(await courseOperationsApiService.listAdvisorPublishedCourseReports(id, courseId), 'advisorCourseReports'), enabled: positiveId(selectedCourseId), retry: false});

  useEffect(() => {
    if (!hours.data) return;
    const purchasedMinutes = contractRecordNumber(hours.data, 'purchasedMinutes', 'totalPurchasedMinutes');
    const expectedVersion = contractRecordNumber(hours.data, 'hoursVersion', 'version');
    setHoursForm(current => ({...current, purchasedMinutes: purchasedMinutes == null ? current.purchasedMinutes : String(purchasedMinutes), expectedVersion: expectedVersion == null ? current.expectedVersion : String(expectedVersion)}));
  }, [hours.data]);

  const sendMessage = useMutation({
    mutationFn: () => {
      const clientMessageId = crypto.randomUUID();
      return messageFiles.length > 0
        ? advisorApiService.sendConversationMessageMultipart(id, {clientMessageId, body: messageBody.trim() || undefined, files: messageFiles})
        : advisorApiService.sendConversationMessage(id, {clientMessageId, body: messageBody.trim()});
    },
    onSuccess: async () => {
      setMessageBody('');
      setMessageFiles([]);
      setFileInputKey(current => current + 1);
      await Promise.all([queryClient.invalidateQueries({queryKey: ['advisor', 'student-conversation', id]}), queryClient.invalidateQueries({queryKey: ['advisor', 'conversations']})]);
    },
  });
  const markRead = useMutation({mutationFn: (messageId: number) => advisorApiService.markConversationRead(id, {messageId}), onSuccess: async () => queryClient.invalidateQueries({queryKey: ['advisor', 'conversations']})});
  const saveHours = useMutation({
    mutationFn: () => courseOperationsApiService.setAdvisorStudentCourseHours(id, courseId, {purchasedMinutes: Number(hoursForm.purchasedMinutes), expectedVersion: Number(hoursForm.expectedVersion), reason: hoursForm.reason.trim() || undefined}),
    onSuccess: async () => queryClient.invalidateQueries({queryKey: ['advisor', 'student-course-hours', id, courseId]}),
  });
  const taskFeedback = useMutation({mutationFn: () => advisorApiService.feedbackAdvisorTask(id, Number(advanced.taskId), {expectedVersion: Number(advanced.taskVersion), feedback: advanced.feedback.trim()})});
  const occurrenceAttendance = useQuery({queryKey: ['advisor', 'occurrence-attendance', id, courseId, advanced.occurrenceId], queryFn: async () => unwrapData(await courseOperationsApiService.getAdvisorStudentOccurrenceAttendance(id, courseId, Number(advanced.occurrenceId)), 'advisorOccurrenceAttendance'), enabled: positiveId(selectedCourseId) && positiveId(advanced.occurrenceId), retry: false});
  const reportDetail = useQuery({queryKey: ['advisor', 'published-course-report', id, courseId, advanced.reportId], queryFn: async () => unwrapData(await courseOperationsApiService.getAdvisorPublishedCourseReport(id, courseId, Number(advanced.reportId)), 'advisorPublishedCourseReport'), enabled: positiveId(selectedCourseId) && positiveId(advanced.reportId), retry: false});

  const conversationRows = advisorConversationMessageViews(messages.data);
  const primaryError = hub.error || studentReports.error || attendance.error || courses.error || messages.error || sendMessage.error || markRead.error;

  const previewAttachment = async (attachmentId: number): Promise<void> => {
    const popup = openPreviewWindow();
    if (!popup) throw new Error('Allow pop-ups to preview this attachment.');
    try {
      const blob = await advisorApiService.previewConversationAttachment(id, attachmentId);
      showBlobInPreviewWindow(popup, blob);
    } catch (error) {
      popup.close();
      throw error;
    }
  };

  return (
    <div className={styles.grid}>
      {primaryError ? <p className={styles.error} role="alert">{advisingErrorMessage(primaryError, 'Student support information could not be loaded.')}</p> : null}

      <section className={styles.card} id="conversation">
        <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Student support</p><h2>Conversation</h2></div><span className={styles.countBadge}>{conversationRows.length}</span></div>
        {messages.isPending ? <p className={styles.status}>Loading conversation…</p> : null}
        {!messages.isPending && conversationRows.length === 0 ? <div className={styles.emptyState}><strong>No messages yet</strong><span>Start the conversation below. File actions appear on messages that have attachments.</span></div> : null}
        <div className={styles.messageList}>
          {conversationRows.map((message, index) => (
            <article className={styles.messageRow} key={message.messageId ?? index}>
              <div className={styles.rowTitle}><strong>{message.senderUserId == null ? 'Conversation message' : `User #${message.senderUserId}`}</strong>{message.createdAt ? <small>{formatDateTime(message.createdAt)}</small> : null}</div>
              <p>{message.body || 'Message has no text content.'}</p>
              {(message.attachments?.length ?? 0) > 0 ? <div className={styles.attachmentList}>{message.attachments?.map(attachment => attachment.attachmentId == null ? null : (
                <div className={styles.attachmentRow} key={attachment.attachmentId}>
                  <span>{attachment.originalName || `Attachment #${attachment.attachmentId}`}</span>
                  <div className={styles.actions}>
                    {attachment.previewAvailable ? <button type="button" className={styles.secondary} onClick={() => void previewAttachment(attachment.attachmentId!)}>Preview</button> : null}
                    <button type="button" className={styles.secondary} onClick={() => void advisorApiService.downloadConversationAttachment(id, attachment.attachmentId!).then(blob => saveBlob(blob, attachment.originalName || `conversation-attachment-${attachment.attachmentId}`))}>Download</button>
                  </div>
                </div>
              ))}</div> : null}
              {message.messageId != null ? <button type="button" className={styles.textButton} disabled={markRead.isPending} onClick={() => markRead.mutate(message.messageId!)}>Mark read through this message</button> : null}
            </article>
          ))}
        </div>
        <form className={styles.composeBox} onSubmit={event => { event.preventDefault(); sendMessage.mutate(); }}>
          <label htmlFor="advisor-message">Reply to student</label>
          <textarea id="advisor-message" value={messageBody} onChange={event => setMessageBody(event.target.value)} placeholder="Write a support message…"/>
          <label htmlFor="advisor-message-files">Attachments</label>
          <input key={fileInputKey} id="advisor-message-files" type="file" multiple onChange={event => setMessageFiles(Array.from(event.target.files ?? []))}/>
          {messageFiles.length > 0 ? <div className={styles.selectedFiles}>{messageFiles.map((file, index) => <span key={`${file.name}-${file.lastModified}-${index}`}>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setMessageFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></span>)}</div> : null}
          <div className={styles.actions}><button className={styles.primary} disabled={(!messageBody.trim() && messageFiles.length === 0) || sendMessage.isPending}>{sendMessage.isPending ? 'Sending…' : 'Send message'}</button></div>
        </form>
      </section>

      <div className={styles.advisorColumns}>
        <section className={styles.card}>
          <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Progress</p><h2>Reports</h2></div></div>
          {studentReports.isPending ? <p className={styles.status}>Loading reports…</p> : null}
          {!studentReports.isPending && contractItems(studentReports.data).length === 0 ? <div className={styles.emptyState}><strong>No published reports</strong><span>Reports become visible here after publication.</span></div> : null}
          {contractItems(studentReports.data).length > 0 ? <div className={styles.compactResult}><RecordSummaryList value={studentReports.data}/></div> : null}
        </section>
        <section className={styles.card}>
          <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Attendance</p><h2>Learning history</h2></div></div>
          {attendance.isPending ? <p className={styles.status}>Loading attendance…</p> : null}
          {!attendance.isPending && contractItems(attendance.data).length === 0 ? <div className={styles.emptyState}><strong>No attendance records</strong><span>Recorded course attendance will appear here.</span></div> : null}
          {contractItems(attendance.data).length > 0 ? <div className={styles.compactResult}><RecordSummaryList value={attendance.data}/></div> : null}
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Course service</p><h2>Course hours &amp; reports</h2></div></div>
        {(courses.data?.length ?? 0) === 0 ? <div className={styles.emptyState}><strong>No linked courses</strong><span>Link or create a course before managing hours and course reports.</span><Link className={styles.secondaryLink} to={`/advisor/students/${id}/courses`}>Open courses</Link></div> : (
          <label className={styles.coursePicker}>Course<select value={selectedCourseId} onChange={event => setSelectedCourseId(event.target.value)}><option value="">Select a course</option>{(courses.data ?? []).map((item, index) => <option key={item.courseId ?? index} value={item.courseId}>{item.title || item.courseCode || `Course #${item.courseId}`}</option>)}</select></label>
        )}
        {positiveId(selectedCourseId) ? <div className={styles.advisorColumns}>
          <div>
            <h3>Purchased hours</h3>
            {hours.isError ? <p className={styles.error}>{advisingErrorMessage(hours.error, 'Course hours could not be loaded.')}</p> : null}
            <form className={styles.form} onSubmit={event => { event.preventDefault(); saveHours.mutate(); }}>
              <label>Purchased minutes<input required type="number" min="0" value={hoursForm.purchasedMinutes} onChange={event => setHoursForm(current => ({...current, purchasedMinutes: event.target.value}))}/></label>
              <label>Record version<input required type="number" min="0" value={hoursForm.expectedVersion} onChange={event => setHoursForm(current => ({...current, expectedVersion: event.target.value}))}/></label>
              <label>Reason<textarea value={hoursForm.reason} onChange={event => setHoursForm(current => ({...current, reason: event.target.value}))}/></label>
              <button className={styles.primary} disabled={!hoursForm.purchasedMinutes || !hoursForm.expectedVersion || saveHours.isPending}>Save purchased hours</button>
            </form>
          </div>
          <div>
            <h3>Published course reports</h3>
            {courseReports.isError ? <p className={styles.error}>{advisingErrorMessage(courseReports.error, 'Course reports could not be loaded.')}</p> : null}
            {!courseReports.isPending && contractItems(courseReports.data).length === 0 ? <div className={styles.emptyState}><strong>No published course reports</strong><span>Published reports for this course will appear here.</span></div> : null}
            {contractItems(courseReports.data).length > 0 ? <div className={styles.compactResult}><RecordSummaryList value={courseReports.data}/></div> : null}
          </div>
        </div> : null}
      </section>

      <details className={styles.card}>
        <summary className={styles.detailsSummary}>Advanced record lookup</summary>
        <p className={styles.muted}>Use backend record identifiers only when handling a specific task, occurrence, or report.</p>
        <div className={styles.advisorColumns}>
          <form className={styles.form} onSubmit={event => { event.preventDefault(); taskFeedback.mutate(); }}>
            <h3>Task feedback</h3>
            <label>Task ID<input inputMode="numeric" value={advanced.taskId} onChange={event => setAdvanced(current => ({...current, taskId: event.target.value}))}/></label>
            <label>Record version<input type="number" min="0" value={advanced.taskVersion} onChange={event => setAdvanced(current => ({...current, taskVersion: event.target.value}))}/></label>
            <label>Feedback<textarea value={advanced.feedback} onChange={event => setAdvanced(current => ({...current, feedback: event.target.value}))}/></label>
            <button className={styles.primary} disabled={!positiveId(advanced.taskId) || !advanced.taskVersion || !advanced.feedback.trim() || taskFeedback.isPending}>Save feedback</button>
          </form>
          <div className={styles.form}>
            <h3>Course records</h3>
            <label>Occurrence ID<input inputMode="numeric" disabled={!positiveId(selectedCourseId)} value={advanced.occurrenceId} onChange={event => setAdvanced(current => ({...current, occurrenceId: event.target.value}))}/></label>
            {occurrenceAttendance.data !== undefined ? <div className={styles.compactResult}><RecordSummaryList value={occurrenceAttendance.data}/></div> : null}
            <label>Published report ID<input inputMode="numeric" disabled={!positiveId(selectedCourseId)} value={advanced.reportId} onChange={event => setAdvanced(current => ({...current, reportId: event.target.value}))}/></label>
            {reportDetail.data !== undefined ? <div className={styles.compactResult}><RecordSummaryList value={reportDetail.data}/></div> : null}
          </div>
        </div>
      </details>

      {hub.data !== undefined ? <details className={styles.card}><summary className={styles.detailsSummary}>Student support summary</summary><div className={styles.compactResult}><RecordSummaryList value={hub.data}/></div></details> : null}
    </div>
  );
};

export default SupportPage;
