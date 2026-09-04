import React, {useEffect, useId, useRef, useState} from 'react';
import {generatePath, Link, useParams, useSearchParams} from 'react-router-dom';
import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  Send,
  Paperclip,
  Download,
  Eye,
  Clock,
  FileText,
} from 'lucide-react';
import {unwrapData} from '@/apis';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {advisorApiService} from '@/apis/services/advisor-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import {useAuth} from '@/contexts/AuthContext';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import {getApiErrorCode} from '@/utils/apiError';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {advisingQueryKeys} from '../advising/queryKeys';
import {SupportReportList} from './SupportReportList';
import {TenantDrawer} from '@/components/TenantWorkspace/TenantDrawer';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {
  advisorConversationMessageViews,
  contractItems,
  contractRecordNumber,
} from '../AdvisorOperationsPage/advisorViewModels';
import layout from './index.module.scss';
import styles from '../advising/advising.module.scss';
import s from './SupportPage.module.scss';

const positiveId = (value: string): boolean => Number.isInteger(Number(value)) && Number(value) > 0;

const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const SupportPage: React.FC<{studentId?: number; conversationOnly?: boolean}> = ({studentId, conversationOnly = false}) => {
  const {studentUserId} = useParams();
  const {user} = useAuth();
  const fileInputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<unknown>();
  const id = studentId ?? Number(studentUserId);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const idempotency = useIdempotencyCheckpoint();
  const [reportPage, setReportPage] = useState(0);
  const [courseReportPage, setCourseReportPage] = useState(0);
  const [messageBody, setMessageBody] = useState('');
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState(searchParams.get('courseId') ?? '');
  const previousCourseSelection = useRef(selectedCourseId);
  const [openedReport, setOpenedReport] = useState<{courseId: number; reportId: number}>();
  const hoursInitializedFor = useRef<number | null>(null);
  const [hoursReloadRequired, setHoursReloadRequired] = useState(false);
  const [hoursForm, setHoursForm] = useState({purchasedMinutes: '', expectedVersion: '', reason: ''});
  const [advanced, setAdvanced] = useState({
    taskId: '',
    taskVersion: '',
    feedback: '',
    occurrenceId: '',
    reportId: searchParams.get('reportId') ?? '',
  });

  const hub = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-hub', id],
    queryFn: async () => unwrapData(await advisorApiService.getStudentHub(id), 'advisorStudentHub'),
    enabled: Number.isInteger(id) && id > 0,
    retry: false,
  });
  const studentReports = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-reports', id, reportPage],
    queryFn: async () => unwrapData(await advisorApiService.listStudentPublishedReports(id, reportPage), 'advisorStudentReports'),
    enabled: Number.isInteger(id) && id > 0 && !conversationOnly,
    retry: false,
  });
  const attendance = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-attendance', id],
    queryFn: async () => unwrapData(await courseOperationsApiService.getAdvisorStudentAttendance(id), 'advisorStudentAttendance'),
    enabled: Number.isInteger(id) && id > 0 && !conversationOnly,
    retry: false,
  });
  const courses = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-courses', id],
    queryFn: async () => unwrapData(await advisorApiService.listStudentCourses(id), 'advisorStudentCourses'),
    enabled: Number.isInteger(id) && id > 0 && !conversationOnly,
    retry: false,
  });
  const plan = useQuery({
    meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorStudyPlan(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudyPlan(id), 'advisorStudyPlan'),
    enabled: Number.isInteger(id) && id > 0 && !conversationOnly,
    retry: false,
  });
  const planTasks = plan.data?.plan?.checkpoints?.flatMap(checkpoint => checkpoint.tasks ?? []) ?? [];
  const messages = useInfiniteQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-conversation', id],
    queryFn: async ({pageParam}) =>
      advisorConversationMessageViews(
        unwrapData(await advisorApiService.listConversationMessages(id, pageParam), 'advisorConversationMessages')
      ),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: lastPage => {
      const ids = lastPage.flatMap(message => (message.messageId == null ? [] : [message.messageId]));
      return ids.length ? Math.min(...ids) : undefined;
    },
    enabled: Number.isInteger(id) && id > 0,
    retry: false,
  });

  const courseId = Number(selectedCourseId);
  const hours = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-course-hours', id, courseId],
    queryFn: async () => unwrapData(await courseOperationsApiService.getAdvisorStudentCourseHours(id, courseId), 'advisorStudentCourseHours'),
    enabled: positiveId(selectedCourseId) && !conversationOnly,
    retry: false,
  });
  const courseReports = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-course-reports', id, courseId, courseReportPage],
    queryFn: async () => unwrapData(await courseOperationsApiService.listAdvisorPublishedCourseReports(id, courseId, courseReportPage + 1, 20), 'advisorCourseReports'),
    enabled: positiveId(selectedCourseId) && !conversationOnly,
    retry: false,
  });

  useEffect(() => {
    // Preserve an initial deep-linked report; reset dependent drafts only on a course change.
    if (previousCourseSelection.current === selectedCourseId) return;
    previousCourseSelection.current = selectedCourseId;
    hoursInitializedFor.current = null;
    setHoursForm({purchasedMinutes: '', expectedVersion: '', reason: ''});
    setHoursReloadRequired(false);
    setCourseReportPage(0);
    setAdvanced(current => ({...current, occurrenceId: '', reportId: ''}));
  }, [selectedCourseId]);

  useEffect(() => {
    if (!hours.data || hoursInitializedFor.current === courseId) return;
    hoursInitializedFor.current = courseId;
    const purchasedMinutes = contractRecordNumber(hours.data, 'purchasedMinutes', 'totalPurchasedMinutes');
    const expectedVersion = contractRecordNumber(hours.data, 'hoursVersion', 'version');
    setHoursForm(current => ({
      ...current,
      purchasedMinutes: purchasedMinutes == null ? current.purchasedMinutes : String(purchasedMinutes),
      expectedVersion: expectedVersion == null ? current.expectedVersion : String(expectedVersion),
    }));
  }, [hours.data, courseId]);

  const sendMessage = useMutation({
    meta: {advisingStudentId: id},
    mutationFn: async () => {
      if (messageFiles.some(file => file.type.startsWith('audio/'))) throw new Error('Audio attachments are not supported.');
      const draft = {body: messageBody.trim(), files: messageFiles};
      const fingerprint = idempotencyFingerprint(draft);
      const clientMessageId = idempotency.keyFor(`message-client-${id}`, fingerprint);
      const result = await idempotency.run(`message-send-${id}`, draft, key =>
        messageFiles.length > 0
          ? advisorApiService.sendConversationMessageMultipart(
              id,
              {clientMessageId, body: draft.body || undefined, files: messageFiles},
              key
            )
          : advisorApiService.sendConversationMessage(id, {clientMessageId, body: draft.body}, key)
      );
      idempotency.completeFingerprint(`message-client-${id}`, fingerprint);
      return result;
    },
    onSuccess: async () => {
      setMessageBody('');
      setMessageFiles([]);
      setFileInputKey(current => current + 1);
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['advisor', 'student-conversation', id]}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'conversations']}),
      ]);
    },
  });

  const markRead = useMutation({
    meta: {advisingStudentId: id},
    mutationFn: (messageId: number) =>
      idempotency.run(
        'markConversationRead',
        [id, {messageId}] satisfies Parameters<typeof advisorApiService.markConversationRead>,
        (key, args) => advisorApiService.markConversationRead(...args, key)
      ),
    onSuccess: async () => queryClient.invalidateQueries({queryKey: ['advisor', 'conversations']}),
  });

  const saveHours = useMutation({
    meta: {advisingStudentId: id},
    mutationFn: () =>
      idempotency.run(
        'setAdvisorStudentCourseHours',
        [
          id,
          courseId,
          {
            purchasedMinutes: Number(hoursForm.purchasedMinutes),
            expectedVersion: Number(hoursForm.expectedVersion),
            reason: hoursForm.reason.trim() || undefined,
          },
        ] satisfies Parameters<typeof courseOperationsApiService.setAdvisorStudentCourseHours>,
        (key, args) => courseOperationsApiService.setAdvisorStudentCourseHours(...args, key)
      ),
    onError: error => {
      if (getApiErrorCode(error)?.endsWith('VERSION_CONFLICT')) setHoursReloadRequired(true);
    },
    onSuccess: async () => {
      hoursInitializedFor.current = null;
      await queryClient.invalidateQueries({queryKey: ['advisor', 'student-course-hours', id, courseId]});
    },
  });

  const taskFeedback = useMutation({
    meta: {advisingStudentId: id},
    mutationFn: () =>
      idempotency.run(
        'feedbackAdvisorTask',
        [
          id,
          Number(advanced.taskId),
          {expectedVersion: Number(advanced.taskVersion), feedback: advanced.feedback.trim()},
        ] satisfies Parameters<typeof advisorApiService.feedbackAdvisorTask>,
        (key, args) => advisorApiService.feedbackAdvisorTask(...args, key)
      ),
    onSuccess: async result => {
      const updated = unwrapData(result, 'advisorTaskFeedback');
      setAdvanced(current => current.taskId === String(updated.id) && updated.version != null
        ? {...current, taskVersion: String(updated.version)} : current);
      await queryClient.invalidateQueries({queryKey: advisingQueryKeys.advisorStudyPlan(id)});
    },
  });

  const occurrenceAttendance = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'occurrence-attendance', id, courseId, advanced.occurrenceId],
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.getAdvisorStudentOccurrenceAttendance(id, courseId, Number(advanced.occurrenceId)),
        'advisorOccurrenceAttendance'
      ),
    enabled: positiveId(selectedCourseId) && positiveId(advanced.occurrenceId),
    retry: false,
  });

  const reportDetail = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'published-course-report', id, courseId, advanced.reportId],
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.getAdvisorPublishedCourseReport(id, courseId, Number(advanced.reportId)),
        'advisorPublishedCourseReport'
      ),
    enabled: positiveId(selectedCourseId) && positiveId(advanced.reportId),
    retry: false,
  });
  const selectedReport = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'published-course-report', id, openedReport?.courseId, openedReport?.reportId],
    queryFn: async () => {
      if (!openedReport) throw new Error('Select a report to view.');
      return unwrapData(await courseOperationsApiService.getAdvisorPublishedCourseReport(id, openedReport.courseId, openedReport.reportId), 'advisorPublishedCourseReport');
    },
    enabled: Boolean(openedReport),
    retry: false,
  });

  const conversationRows = [
    ...new Map((messages.data?.pages.flat() ?? []).map(message => [message.messageId, message])).values(),
  ].sort((left, right) => (left.messageId ?? 0) - (right.messageId ?? 0));

  const primaryError =
    hub.error || studentReports.error || attendance.error || courses.error || messages.error || sendMessage.error || markRead.error;

  const previewAttachment = async (attachmentId: number): Promise<void> => {
    const popup = openPreviewWindow();
    setFileError(undefined);
    if (!popup) {setFileError(new Error('Allow pop-ups to preview this attachment.')); return;}
    try {
      const blob = await advisorApiService.previewConversationAttachment(id, attachmentId);
      showBlobInPreviewWindow(popup, blob);
    } catch (error) {
      popup.close();
      setFileError(error);
    }
  };

  const conversationContent = (
        <div className={`${s.conversationCard} ${conversationOnly ? s.standalone : ''}`}>
          <div className={s.messageStream} aria-label="Message history">
            {messages.isPending ? <p className={styles.status}>Loading conversation…</p> : null}

            {messages.hasNextPage ? (
              <button
                type="button"
                className={s.loadOlderButton}
                disabled={messages.isFetchingNextPage}
                onClick={() => void messages.fetchNextPage()}
              >
                <Clock size={13} aria-hidden="true" />
                <span>{messages.isFetchingNextPage ? 'Loading…' : 'Load older messages'}</span>
              </button>
            ) : null}

            {!messages.isPending && !messages.isError && conversationRows.length === 0 ? (
              <div className={s.emptyBlock}>
                <strong>No messages yet</strong>
                <span>Start the conversation below. File actions appear on messages that have attachments.</span>
              </div>
            ) : null}

            {conversationRows.map((message, index) => {
              const isStudent = message.senderUserId === id;
              const isAdvisor = message.senderUserId === user?.id;

              return (
                <article
                  className={`${s.messageItem} ${isAdvisor ? s.advisorMessage : s.studentMessage}`}
                  key={message.messageId ?? index}
                >
                  <div className={s.messageMeta}>
                    <span className={s.messageSender}>
                      {isAdvisor ? 'You' : isStudent ? (hub.data?.firstName ? [hub.data.firstName, hub.data.middleName, hub.data.lastName].filter(Boolean).join(' ') : `Student #${id}`) : 'Advisor'}
                    </span>
                    {message.createdAt ? (
                      <span className={s.messageTime}>{formatDateTime(message.createdAt)}</span>
                    ) : null}
                  </div>

                  <p>{message.body || 'Message has no text content.'}</p>

                  {(message.attachments?.length ?? 0) > 0 ? (
                    <div className={s.attachmentList}>
                      {message.attachments?.map(attachment =>
                        attachment.attachmentId == null ? null : (
                          <div className={s.attachmentRow} key={attachment.attachmentId}>
                            <span>
                              <FileText size={14} aria-hidden="true" />
                              {attachment.originalName || `Attachment #${attachment.attachmentId}`}
                            </span>
                            <div className={s.attachmentActions}>
                              {attachment.previewAvailable ? (
                                <button
                                  type="button"
                                  onClick={() => void previewAttachment(attachment.attachmentId!)}
                                >
                                  <Eye size={12} aria-hidden="true" />
                                  Preview
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  void advisorApiService
                                    .downloadConversationAttachment(id, attachment.attachmentId!)
                                    .then(blob =>
                                      saveBlob(blob, attachment.originalName || `conversation-attachment-${attachment.attachmentId}`)
                                    ).catch(setFileError)
                                }
                              >
                                <Download size={12} aria-hidden="true" />
                                Download
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : null}

                  {message.messageId != null && isStudent ? (
                    <button
                      type="button"
                      className={s.markReadButton}
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(message.messageId!)}
                    >
                      Mark read through this message
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>

          <form
            className={s.composer}
            onSubmit={event => {
              event.preventDefault();
              sendMessage.mutate();
            }}
          >
            <label htmlFor="advisor-message" className={styles.srOnly}>
              Reply to student
            </label>
            <textarea
              id="advisor-message"
              className={s.composerTextarea}
              value={messageBody}
              onChange={event => setMessageBody(event.target.value)}
              placeholder="Write a support message to this student…"
            />

            {messageFiles.length > 0 ? (
              <div className={s.selectedFiles}>
                {messageFiles.map((file, index) => (
                  <span className={s.fileTag} key={`${file.name}-${file.lastModified}-${index}`}>
                    <FileText size={12} aria-hidden="true" />
                    {file.name}
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setMessageFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className={s.composerActions}>
              <div className={s.fileInputWrapper}>
                <button type="button" className={s.attachButton} onClick={() => fileInput.current?.click()}>
                  <Paperclip size={14} aria-hidden="true" />
                  Attach files
                </button>
                  <input
                    ref={fileInput}
                    aria-label="Attach message files"
                    key={fileInputKey}
                    id={fileInputId}
                    type="file"
                    multiple
                    onChange={event => setMessageFiles(Array.from(event.target.files ?? []))}
                  />
              </div>

              <button
                type="submit"
                className={s.sendButton}
                disabled={(!messageBody.trim() && messageFiles.length === 0) || sendMessage.isPending || hub.isError || hub.isPending}
              >
                <Send size={14} aria-hidden="true" />
                {sendMessage.isPending ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </form>
        </div>
      );
  if (conversationOnly) return <>{primaryError || fileError ? <p className={styles.error} role="alert">{advisingErrorMessage(primaryError || fileError, 'The conversation could not be loaded or updated.')} <button type="button" onClick={() => void messages.refetch()}>Retry conversation</button></p> : null}{conversationContent}</>;

  return (
    <div className={layout.support}>
      {primaryError || fileError ? (
        <p className={styles.error} role="alert">
          {advisingErrorMessage(primaryError || fileError, 'Student support information could not be loaded.')}
        </p>
      ) : null}

      <WorkspaceSection appearance="record" title="Conversation" id="conversation" meta={<span className={s.countBadge}>{conversationRows.length}</span>}>{conversationContent}</WorkspaceSection>


      {/* Reports and attendance remain visible beside one another on desktop. */}
      <div className={s.mainGrid}>
        <WorkspaceSection appearance="record"
          title="Reports"
          meta={
            <span className={s.countBadge}>
              {contractRecordNumber(studentReports.data, 'total') ?? contractItems(studentReports.data).length}
            </span>
          }
        >
          {studentReports.isPending ? <p className={styles.status}>Loading reports…</p> : null}
          {!studentReports.isPending && !studentReports.isError && contractItems(studentReports.data).length === 0 ? (
            <div className={s.emptyBlock}>
              <FileText size={32} aria-hidden="true"/>
              <strong>No published reports</strong>
              <span>Reports become visible here after publication.</span>
            </div>
          ) : null}
          {contractItems(studentReports.data).length > 0 ? (
            <div className={styles.compactResult}>
              <SupportReportList value={studentReports.data} onOpen={(courseId, reportId) => setOpenedReport({courseId, reportId})}/>
            </div>
          ) : null}
          <AdvisingPagination
            label="Student report pages"
            page={reportPage}
            total={contractRecordNumber(studentReports.data, 'total') ?? 0}
            onPage={setReportPage}
          />
        </WorkspaceSection>

        <WorkspaceSection appearance="record"
          title="Learning history"
          meta={<span className={s.countBadge}>{contractItems(attendance.data).length}</span>}
        >
          {attendance.isPending ? <p className={styles.status}>Loading attendance…</p> : null}
          {!attendance.isPending && !attendance.isError && contractItems(attendance.data).length === 0 ? (
            <div className={s.emptyBlock}>
              <Clock size={32} aria-hidden="true"/>
              <strong>No attendance records</strong>
              <span>Recorded course attendance will appear here.</span>
            </div>
          ) : null}
          {contractItems(attendance.data).length > 0 ? (
            <div className={styles.compactResult}>
              <RecordSummaryList value={attendance.data} />
            </div>
          ) : null}
        </WorkspaceSection>
      </div>

      {/* Course Hours & Reports */}
      <WorkspaceSection appearance="record" title="Course hours &amp; reports" id="course-support">
        {(courses.data?.length ?? 0) === 0 ? (
          <div className={s.emptyBlock}>
            <strong>No linked courses</strong>
            <span>Link or create a course before managing hours and course reports.</span>
            <Link className={styles.secondaryLink} to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdCourses, {studentUserId: String(id)})}>
              Open courses
            </Link>
          </div>
        ) : (
          <label className={s.coursePickerLabel}>
            Course
            <select value={selectedCourseId} disabled={saveHours.isPending} onChange={event => {setSelectedCourseId(event.target.value); saveHours.reset();}}>
              <option value="">Select a course</option>
              {(courses.data ?? []).map((item, index) => (
                <option key={item.courseId ?? index} value={item.courseId}>
                  {item.title || item.courseCode || `Course #${item.courseId}`}
                </option>
              ))}
            </select>
          </label>
        )}

        {positiveId(selectedCourseId) ? (
          <div className={s.courseSupport}>
            <div className={s.hoursWidget}>
              <div className={s.hourStat}>
                <strong>{hours.isPending ? '…' : hours.isError || !hoursForm.purchasedMinutes ? '—' : `${hoursForm.purchasedMinutes}m`}</strong>
                <span>Purchased minutes</span>
              </div>
              <div className={s.hourStat}>
                <strong>{hours.isSuccess ? contractRecordNumber(hours.data, 'remainingMinutes') ?? '—' : '—'}</strong>
                <span>Remaining minutes</span>
              </div>
            </div>

            {hoursReloadRequired ? (
              <div className={styles.conflictNotice} role="alert">
                <p>Your entered hours are preserved. Reload the latest version before confirming.</p>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() =>
                    void hours.refetch().then(result => {
                      if (previousCourseSelection.current !== selectedCourseId) return;
                      const version = contractRecordNumber(result.data, 'hoursVersion', 'version');
                      if (!result.isError && version != null) {
                        setHoursForm(current => ({...current, expectedVersion: String(version)}));
                        setHoursReloadRequired(false);
                      }
                    })
                  }
                >
                  Load latest hours
                </button>
              </div>
            ) : null}

            {hours.isError ? (
              <p className={styles.error}>{advisingErrorMessage(hours.error, 'Course hours could not be loaded.')}</p>
            ) : null}

            <form
              className={s.formGrid}
              onSubmit={event => {
                event.preventDefault();
                saveHours.mutate();
              }}
            >
              <label>
                Purchased minutes
                <input
                  required
                  type="number"
                  min="0"
                  value={hoursForm.purchasedMinutes}
                  onChange={event => setHoursForm(current => ({...current, purchasedMinutes: event.target.value}))}
                />
              </label>
              <label>
                Reason for adjustment
                <textarea
                  required
                  value={hoursForm.reason}
                  onChange={event => setHoursForm(current => ({...current, reason: event.target.value}))}
                  placeholder="Specify the reason for this allocation change…"
                />
              </label>
              <button
                className={styles.primary}
                disabled={
                  hoursReloadRequired || hours.isPending || hours.isError ||
                  !hoursForm.reason.trim() ||
                  !hoursForm.purchasedMinutes ||
                  !hoursForm.expectedVersion ||
                  saveHours.isPending
                }
              >
                {saveHours.isPending ? 'Saving…' : 'Save purchased hours'}
              </button>
            </form>

            <div className={s.publishedReports}>
              <h4 className={s.reportsTitle}>Published course reports</h4>
              <AdvisingPagination
                label="Course report pages"
                page={courseReportPage}
                total={contractRecordNumber(courseReports.data, 'total') ?? 0}
                onPage={setCourseReportPage}
              />
              {courseReports.isError ? (
                <p className={styles.error}>{advisingErrorMessage(courseReports.error, 'Course reports could not be loaded.')}</p>
              ) : null}
              {!courseReports.isPending && !courseReports.isError && contractItems(courseReports.data).length === 0 ? (
                <div className={s.emptyBlock}>
                  <strong>No published course reports</strong>
                  <span>Reports for this course will appear here.</span>
                </div>
              ) : null}
              {contractItems(courseReports.data).length > 0 ? (
                <div className={styles.compactResult}>
                  <SupportReportList value={courseReports.data} courseId={courseId} onOpen={(courseId, reportId) => setOpenedReport({courseId, reportId})}/>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </WorkspaceSection>

      {saveHours.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(saveHours.error, 'Purchased hours could not be saved.')}</p> : null}
      {saveHours.isSuccess ? <p className={styles.success} role="status">Purchased hours saved.</p> : null}

      {/* Optional reference lookups remain available without crowding the daily workflow. */}
      <CollapsibleSection title="Advanced record lookup">
        <p className={styles.muted}>Look up a specific task, class, or report by its reference number.</p>
        <div className={s.advancedGrid}>
          <form
            className={styles.form}
            onSubmit={event => {
              event.preventDefault();
              taskFeedback.mutate();
            }}
          >
            <h4>Task feedback</h4>
            <label>
              Learning plan task
              <select
                value={advanced.taskId}
                onChange={event => {const task = planTasks.find(task => String(task.id) === event.target.value); setAdvanced(current => ({...current, taskId: event.target.value, taskVersion: task?.version == null ? '' : String(task.version), feedback: task?.advisorFeedback ?? ''})); taskFeedback.reset();}}
              ><option value="">Choose a task</option>{planTasks.filter(task => task.id != null).map(task => <option key={task.id} value={task.id}>{task.title || `Task #${task.id}`}</option>)}</select>
            </label>
            {plan.isError ? <p className={styles.error} role="alert">Tasks could not be loaded. <button type="button" onClick={() => void plan.refetch()}>Retry tasks</button></p> : null}
            {taskFeedback.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(taskFeedback.error, 'Feedback could not be saved.')} <button type="button" onClick={() => void plan.refetch().then(result => {
              if (result.isError) return;
              const reviewedTask = result.data?.plan?.checkpoints?.flatMap(checkpoint => checkpoint.tasks ?? []).find(task => String(task.id) === advanced.taskId);
              if (reviewedTask?.version != null) {setAdvanced(current => current.taskId === String(reviewedTask.id) ? {...current, taskVersion: String(reviewedTask.version)} : current); taskFeedback.reset();}
            })}>Load latest task version</button></p> : null}
            {taskFeedback.isSuccess ? <p className={styles.success} role="status">Feedback saved.</p> : null}
            <label>
              Feedback
              <textarea
                value={advanced.feedback}
                onChange={event => setAdvanced(current => ({...current, feedback: event.target.value}))}
              />
            </label>
            <button
              className={styles.primary}
              disabled={
                !positiveId(advanced.taskId) ||
                !advanced.taskVersion ||
                !advanced.feedback.trim() ||
                taskFeedback.isPending
              }
            >
              Save feedback
            </button>
          </form>

          <div className={styles.form}>
            <h4>Course occurrence records</h4>
            <label>
              Occurrence ID
              <input
                inputMode="numeric"
                disabled={!positiveId(selectedCourseId)}
                value={advanced.occurrenceId}
                onChange={event => setAdvanced(current => ({...current, occurrenceId: event.target.value}))}
              />
            </label>
            {occurrenceAttendance.data !== undefined ? (
              <div className={styles.compactResult}>
                <RecordSummaryList value={occurrenceAttendance.data} />
              </div>
            ) : null}

            <label>
              Published report ID
              <input
                inputMode="numeric"
                disabled={!positiveId(selectedCourseId)}
                value={advanced.reportId}
                onChange={event => setAdvanced(current => ({...current, reportId: event.target.value}))}
              />
            </label>
            {reportDetail.data !== undefined ? (
              <div className={styles.compactResult}>
                <RecordSummaryList value={reportDetail.data} />
              </div>
            ) : null}
          </div>
        </div>
      </CollapsibleSection>

      {hub.data !== undefined ? (
        <CollapsibleSection title="Student support summary">
          <div className={styles.compactResult}>
            <RecordSummaryList value={hub.data} />
          </div>
        </CollapsibleSection>
      ) : null}
      {openedReport ? <TenantDrawer title="Published report" onClose={() => setOpenedReport(undefined)}>
        {selectedReport.isPending ? <p role="status">Loading report…</p> : selectedReport.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(selectedReport.error, 'Report could not be loaded.')} <button type="button" onClick={() => void selectedReport.refetch()}>Retry report</button></p> : <RecordSummaryList value={selectedReport.data}/>}
      </TenantDrawer> : null}
    </div>
  );
};

export default SupportPage;
