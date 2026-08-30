import React, {useEffect, useMemo, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {SCHEDULE_REQUEST_TYPES, unwrapData, type ParentConversationMessageResponse, type ParentNotification} from '@/apis';
import {parentApiService} from '@/apis/services/parent-api';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';

type ParentSection = 'dashboard' | 'learning' | 'schedule' | 'reports' | 'exams' | 'messages' | 'notifications';

const SECTIONS: Array<{id: ParentSection; label: string}> = [
  {id: 'dashboard', label: 'Overview'},
  {id: 'learning', label: 'Learning'},
  {id: 'schedule', label: 'Schedule'},
  {id: 'reports', label: 'Reports'},
  {id: 'exams', label: 'Mock exams'},
  {id: 'messages', label: 'Messages'},
  {id: 'notifications', label: 'Notifications'},
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const linkedStudentIds = (value: unknown): number[] => {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : [];
  return source.flatMap(item => {
    if (!isRecord(item)) return [];
    const id = item.studentUserId;
    return typeof id === 'number' ? [id] : [];
  });
};

const recordItems = (value: unknown): Record<string, unknown>[] => {
  const source = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.items) ? value.items : [];
  return source.filter(isRecord);
};

const numberField = (record: Record<string, unknown>, ...keys: string[]): number | undefined => {
  for (const key of keys) if (typeof record[key] === 'number') return record[key] as number;
  return undefined;
};

const textField = (record: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) if (typeof record[key] === 'string' && (record[key] as string).trim()) return record[key] as string;
  return undefined;
};

const ParentPortalPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [studentUserId, setStudentUserId] = useState<number | null>(null);
  const [section, setSection] = useState<ParentSection>('dashboard');
  const [message, setMessage] = useState('');
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [schedule, setSchedule] = useState({courseId: '', occurrenceId: '', requestType: 'RESCHEDULE', reason: ''});
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const linked = useQuery({
    queryKey: ['parent', 'linked-students'],
    queryFn: async () => unwrapData(await parentApiService.listLinkedStudents(), 'parentLinkedStudents'),
    retry: false,
  });
  const studentIds = useMemo(() => linkedStudentIds(linked.data), [linked.data]);

  useEffect(() => {
    if (studentUserId == null && studentIds.length > 0) setStudentUserId(studentIds[0]);
  }, [studentIds, studentUserId]);

  const content = useQuery({
    queryKey: ['parent', studentUserId, section],
    enabled: studentUserId != null || section === 'notifications',
    retry: false,
    queryFn: async () => {
      if (section === 'notifications') {
        const [notifications, unread] = await Promise.all([parentApiService.listNotifications(), parentApiService.getNotificationUnreadCount()]);
        return {notifications: unwrapData(notifications, 'parentNotifications'), unread: unwrapData(unread, 'parentNotificationUnreadCount')};
      }
      if (studentUserId == null) throw new Error('No linked student selected');
      if (section === 'dashboard') return unwrapData(await parentApiService.getStudentDashboard(studentUserId), 'parentDashboard');
      if (section === 'learning') {
        const [profile, plan, courses, assignments, attendance, hours, risk] = await Promise.all([
          parentApiService.getStudentProfile(studentUserId),
          parentApiService.getStudentStudyPlan(studentUserId),
          parentApiService.listStudentCourses(studentUserId),
          parentApiService.listStudentAssignments(studentUserId),
          parentApiService.listStudentAttendance(studentUserId),
          parentApiService.getStudentHours(studentUserId),
          parentApiService.getStudentRisk(studentUserId),
        ]);
        return {
          profile: unwrapData(profile, 'parentProfile'),
          studyPlan: unwrapData(plan, 'parentStudyPlan'),
          courses: unwrapData(courses, 'parentCourses'),
          assignments: unwrapData(assignments, 'parentAssignments'),
          attendance: unwrapData(attendance, 'parentAttendance'),
          hours: unwrapData(hours, 'parentHours'),
          risk: unwrapData(risk, 'parentRisk'),
        };
      }
      if (section === 'schedule') {
        const [calendar, requests] = await Promise.all([
          parentApiService.listStudentCalendar(studentUserId),
          parentApiService.listScheduleRequests(studentUserId),
        ]);
        return {calendar: unwrapData(calendar, 'parentCalendar'), requests: unwrapData(requests, 'parentScheduleRequests')};
      }
      if (section === 'reports') return unwrapData(await parentApiService.listStudentReports(studentUserId), 'parentReports');
      if (section === 'exams') return unwrapData(await mockExamApiService.listParentStudentExams(studentUserId), 'parentMockExams');
      return unwrapData(await parentApiService.listConversationMessages(studentUserId), 'parentMessages');
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (studentUserId == null) throw new Error('No linked student selected');
      return parentApiService.sendConversationMessage(studentUserId, {clientMessageId: crypto.randomUUID(), body: message.trim() || undefined, files: messageFiles});
    },
    onSuccess: async () => {
      setMessage('');
      setMessageFiles([]);
      setFileInputKey(current => current + 1);
      await queryClient.invalidateQueries({queryKey: ['parent', studentUserId, 'messages']});
    },
  });

  const markMessageRead = useMutation({
    mutationFn: (messageId: number) => parentApiService.markConversationRead(studentUserId!, {messageId}),
    onSuccess: async () => queryClient.invalidateQueries({queryKey: ['parent', studentUserId, 'messages']}),
  });
  const markNotificationRead = useMutation({
    mutationFn: (notificationId: number) => parentApiService.markNotificationRead(notificationId),
    onSuccess: async () => queryClient.invalidateQueries({queryKey: ['parent', studentUserId, 'notifications']}),
  });
  const markAllNotificationsRead = useMutation({
    mutationFn: () => parentApiService.markAllNotificationsRead(),
    onSuccess: async () => queryClient.invalidateQueries({queryKey: ['parent', studentUserId, 'notifications']}),
  });
  const reportDetail = useQuery({
    queryKey: ['parent', studentUserId, 'report', selectedReportId],
    queryFn: async () => unwrapData(await parentApiService.getStudentReport(studentUserId!, selectedReportId!), 'parentReportDetail'),
    enabled: studentUserId != null && selectedReportId != null,
    retry: false,
  });

  const createScheduleRequest = useMutation({
    mutationFn: async () => {
      if (studentUserId == null) throw new Error('No linked student selected');
      return parentApiService.createScheduleRequest(studentUserId, {
        courseId: Number(schedule.courseId),
        occurrenceId: Number(schedule.occurrenceId),
        requestType: schedule.requestType,
        reason: schedule.reason || undefined,
      });
    },
    onSuccess: async () => {
      setSchedule({courseId: '', occurrenceId: '', requestType: 'RESCHEDULE', reason: ''});
      await queryClient.invalidateQueries({queryKey: ['parent', studentUserId, 'schedule']});
    },
  });

  const previewAttachment = async (attachmentId: number): Promise<void> => {
    if (studentUserId == null) throw new Error('No linked student selected');
    const popup = openPreviewWindow();
    if (!popup) throw new Error('Allow pop-ups to preview this attachment.');
    try {
      const blob = await parentApiService.previewConversationAttachment(studentUserId, attachmentId);
      showBlobInPreviewWindow(popup, blob);
    } catch (error) {
      popup.close();
      throw error;
    }
  };

  const contentRecord = isRecord(content.data) ? content.data : null;
  const messages = section === 'messages' && Array.isArray(content.data) ? content.data as ParentConversationMessageResponse[] : [];
  const notifications = section === 'notifications' && contentRecord && Array.isArray(contentRecord.notifications) ? contentRecord.notifications as ParentNotification[] : [];
  const reportRows = section === 'reports' ? recordItems(content.data) : [];
  const calendarRows = section === 'schedule' && contentRecord ? recordItems(contentRecord.calendar) : [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Parent portal</p>
          <h1>Student progress</h1>
          <p className={styles.lede}>Read academic updates, request schedule changes, and contact the advising team.</p>
        </div>
        {studentIds.length > 1 ? (
          <label className={styles.form}>
            Student
            <select value={studentUserId ?? ''} onChange={event => setStudentUserId(Number(event.target.value))}>
              {studentIds.map(id => <option value={id} key={id}>Student #{id}</option>)}
            </select>
          </label>
        ) : null}
      </header>

      {linked.isPending ? <p className={styles.status}>Loading linked students…</p> : null}
      {linked.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(linked.error, 'Linked students could not be loaded.')}</p> : null}
      {linked.isSuccess && studentIds.length === 0 ? <p className={styles.status}>No active student link is available for this account.</p> : null}

      {studentIds.length > 0 ? (
        <>
          <nav className={styles.tabs} aria-label="Parent portal sections">
            {SECTIONS.map(item => (
              <button type="button" className={item.id === section ? styles.primary : styles.secondary} key={item.id} onClick={() => setSection(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>

          {section === 'schedule' ? (
            <section className={styles.card}>
              <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Calendar</p><h2>Request a schedule change</h2></div></div>
              {calendarRows.length === 0 ? <div className={styles.emptyState}><strong>No upcoming class can be changed</strong><span>Schedule actions appear beside available calendar occurrences.</span></div> : <div className={styles.inboxList}>{calendarRows.map((row, index) => {
                const courseId = numberField(row, 'courseId');
                const occurrenceId = numberField(row, 'occurrenceId', 'sessionOccurrenceId');
                const selected = String(courseId) === schedule.courseId && String(occurrenceId) === schedule.occurrenceId;
                return <article className={styles.inboxRow} key={occurrenceId ?? index}><div className={styles.inboxMain}><strong>{textField(row, 'courseTitle', 'courseCode', 'title') || 'Scheduled class'}</strong><span>{[textField(row, 'occurrenceDate', 'date'), textField(row, 'startTime'), textField(row, 'location')].filter(Boolean).join(' · ')}</span></div>{courseId != null && occurrenceId != null ? <button type="button" className={selected ? styles.primary : styles.secondary} onClick={() => setSchedule(current => ({...current, courseId: String(courseId), occurrenceId: String(occurrenceId)}))}>{selected ? 'Selected' : 'Request change'}</button> : null}</article>;
              })}</div>}
              {schedule.courseId && schedule.occurrenceId ? <form className={styles.reviewPanel} onSubmit={event => { event.preventDefault(); createScheduleRequest.mutate(); }}>
                <strong>Selected scheduled class</strong>
                <label>Request type<select value={schedule.requestType} onChange={event => setSchedule(current => ({...current, requestType: event.target.value}))}>{SCHEDULE_REQUEST_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
                <label>Reason<textarea value={schedule.reason} onChange={event => setSchedule(current => ({...current, reason: event.target.value}))}/></label>
                <button className={styles.primary} disabled={createScheduleRequest.isPending}>Submit request</button>
              </form> : null}
              {createScheduleRequest.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(createScheduleRequest.error, 'Schedule request could not be submitted.')}</p> : null}
              {contentRecord?.requests !== undefined ? <div className={styles.compactResult}><RecordSummaryList value={contentRecord.requests} emptyMessage="No schedule requests have been submitted."/></div> : null}
            </section>
          ) : null}

          {section === 'messages' ? (
            <section className={styles.card}>
              <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Student support</p><h2>Conversation</h2></div><span className={styles.countBadge}>{messages.length}</span></div>
              {messages.length === 0 ? <div className={styles.emptyState}><strong>No messages yet</strong><span>Start the conversation below.</span></div> : <div className={styles.messageList}>{messages.map((item, index) => <article className={styles.messageRow} key={item.messageId ?? index}><div className={styles.rowTitle}><strong>{item.senderUserId == null ? 'Conversation message' : `User #${item.senderUserId}`}</strong><small>{item.createdAt || ''}</small></div><p>{item.body || 'Message has no text content.'}</p>{(item.attachments?.length ?? 0) > 0 ? <div className={styles.attachmentList}>{item.attachments?.map(attachment => attachment.attachmentId == null ? null : <div className={styles.attachmentRow} key={attachment.attachmentId}><span>{attachment.originalName || 'Attachment'}</span><div className={styles.actions}>{attachment.previewAvailable ? <button type="button" className={styles.secondary} onClick={() => void previewAttachment(attachment.attachmentId!)}>Preview</button> : null}<button type="button" className={styles.secondary} onClick={() => void parentApiService.downloadConversationAttachment(studentUserId!, attachment.attachmentId!).then(blob => saveBlob(blob, attachment.originalName || 'conversation-attachment'))}>Download</button></div></div>)}</div> : null}{item.messageId != null ? <button type="button" className={styles.textButton} disabled={markMessageRead.isPending} onClick={() => markMessageRead.mutate(item.messageId!)}>Mark read through this message</button> : null}</article>)}</div>}
              <form className={styles.composeBox} onSubmit={event => { event.preventDefault(); sendMessage.mutate(); }}>
                <label htmlFor="parent-message">Message</label><textarea id="parent-message" value={message} onChange={event => setMessage(event.target.value)} placeholder="Write to the advising team…"/>
                <label htmlFor="parent-message-files">Attachments</label><input key={fileInputKey} id="parent-message-files" type="file" multiple onChange={event => setMessageFiles(Array.from(event.target.files ?? []))}/>
                {messageFiles.length > 0 ? <div className={styles.selectedFiles}>{messageFiles.map((file, index) => <span key={`${file.name}-${file.lastModified}-${index}`}>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setMessageFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></span>)}</div> : null}
                <button className={styles.primary} disabled={(!message.trim() && messageFiles.length === 0) || sendMessage.isPending}>Send message</button>
              </form>
              {sendMessage.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(sendMessage.error, 'Message could not be sent.')}</p> : null}
            </section>
          ) : null}

          {section === 'reports' ? (
            <section className={styles.card}><div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Published updates</p><h2>Reports</h2></div><span className={styles.countBadge}>{reportRows.length}</span></div>{reportRows.length === 0 ? <div className={styles.emptyState}><strong>No published reports</strong><span>Published learning reports will appear here.</span></div> : <div className={styles.inboxList}>{reportRows.map((row, index) => { const reportId = numberField(row, 'reportId'); return <article className={styles.inboxRow} key={reportId ?? index}><div className={styles.inboxMain}><strong>{textField(row, 'reportType', 'title') || 'Learning report'}</strong><span>{textField(row, 'overallSummary', 'summary') || textField(row, 'publishedAt') || 'Published report'}</span></div>{reportId != null ? <button type="button" className={styles.secondary} onClick={() => setSelectedReportId(reportId)}>Open report</button> : null}</article>; })}</div>}{reportDetail.data ? <div className={styles.reportDetail}><h3>{reportDetail.data.reportType || 'Report detail'}</h3><p>{reportDetail.data.overallSummary}</p>{reportDetail.data.strengths ? <p><strong>Strengths</strong><br/>{reportDetail.data.strengths}</p> : null}{reportDetail.data.improvementSuggestions ? <p><strong>Next steps</strong><br/>{reportDetail.data.improvementSuggestions}</p> : null}</div> : null}</section>
          ) : null}

          {section === 'notifications' ? (
            <section className={styles.card}><div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Updates</p><h2>Notifications</h2></div><button type="button" className={styles.secondary} disabled={markAllNotificationsRead.isPending || notifications.length === 0} onClick={() => markAllNotificationsRead.mutate()}>Mark all read</button></div>{notifications.length === 0 ? <div className={styles.emptyState}><strong>No notifications</strong><span>New academic updates will appear here.</span></div> : <div className={styles.inboxList}>{notifications.map((item, index) => <article className={styles.inboxRow} key={item.notificationId ?? index}><div className={styles.inboxMain}><div className={styles.rowTitle}><strong>{item.notificationType || 'Notification'}</strong>{item.readAt ? <span className={styles.statusPill}>Read</span> : <span className={styles.unreadBadge}>New</span>}</div><span>{item.message || 'Academic update'}</span><small>{[item.courseCode, item.createdAt].filter(Boolean).join(' · ')}</small></div>{item.notificationId != null && !item.readAt ? <button type="button" className={styles.secondary} disabled={markNotificationRead.isPending} onClick={() => markNotificationRead.mutate(item.notificationId!)}>Mark read</button> : null}</article>)}</div>}</section>
          ) : null}

          {!['schedule', 'messages', 'reports', 'notifications'].includes(section) ? <section className={styles.card}>
            <h2>{SECTIONS.find(item => item.id === section)?.label}</h2>
            {content.isPending ? <p className={styles.status}>Loading…</p> : null}
            {content.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(content.error, 'This section could not be loaded.')}</p> : null}
            {content.data !== undefined ? <RecordSummaryList value={content.data} emptyMessage={`No ${SECTIONS.find(item => item.id === section)?.label.toLowerCase()} records are available.`}/> : null}
          </section> : null}
        </>
      ) : null}
    </main>
  );
};

export default ParentPortalPage;
