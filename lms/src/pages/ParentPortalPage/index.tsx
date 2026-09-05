import {formatNumber} from '@/i18n/formatting';
import {useTranslation} from 'react-i18next';
import {LocalizedError} from '@/i18n/errors';
import { WorkspaceSection } from "@/components/WorkspaceSection";
import {ChevronDown, MessageSquareText, Paperclip, UserRound, X} from 'lucide-react';
import { AdvisingPagination } from "../advising/AdvisingPagination";
import { useIdempotencyCheckpoint } from "@/hooks/useIdempotencyCheckpoint";
import { sendStableMessage } from "@/utils/sendStableMessage";
import {
  getNotificationTitle,
  formatNotificationTime,
} from "@/utils/notificationPresentation";
import {getParentSection, PARENT_SECTIONS, PARENT_LEARNING_TABS} from '@/configs/parentNavigation';
import {ParentSectionNav} from './ParentSectionNav';
import {ParentOverview} from './ParentOverview';
import {ParentSchedule, type ParentScheduleDraft} from './ParentSchedule';
import {ParentReports} from './ParentReports';
import {ParentMockExams} from './ParentMockExams';
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLinkedStudents } from "./useLinkedStudents";
import {formatPersonName} from '@/utils/personName';
import { ParentAcademicSections } from "./ParentAcademicSections";
import parentStyles from "./index.module.scss";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  SCHEDULE_REQUEST_TYPES,
  unwrapData,
  type ParentConversationMessageResponse,
  type ParentNotification,
  type ParentLinkedStudent,
} from "@/apis";
import { parentApiService } from "@/apis/services/parent-api";
import { advisingErrorMessage } from "../advising/advisingErrors";
import styles from "../advising/advising.module.scss";
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {
  openPreviewWindow,
  saveBlob,
  showBlobInPreviewWindow,
} from "@/utils/downloadBlob";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const linkedStudentIds = (value: unknown): number[] => {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : [];
  return source.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = item.studentUserId;
    return typeof id === "number" ? [id] : [];
  });
};

const recordItems = (value: unknown): Record<string, unknown>[] => {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : [];
  return source.filter(isRecord);
};

const numberField = (
  record: Record<string, unknown>,
  ...keys: string[]
): number | undefined => {
  for (const key of keys)
    if (typeof record[key] === "number") return record[key] as number;
  return undefined;
};

const ParentStudentWorkspace: React.FC<{
  studentUserId: number;
  studentIds: number[];
  students: ParentLinkedStudent[];
  onStudentChange: (id: number) => void;
}> = ({ studentUserId, studentIds, students, onStudentChange }) => {
  const {t: translate} = useTranslation();
  const selectedStudent = students.find(student => student.studentUserId === studentUserId);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [notificationPage, setNotificationPage] = useState(0);
  const [params] = useSearchParams();
  const section = getParentSection(params);
  const learningTab = PARENT_LEARNING_TABS.find(tab => tab.id === params.get('tab'))?.id ?? PARENT_LEARNING_TABS[0].id;
  const [reportPage, setReportPage] = useState(0);
  const [attachmentError, setAttachmentError] = useState<unknown>();
  const [attachmentBusy, setAttachmentBusy] = useState<number>();
  const [message, setMessage] = useState("");
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [schedule, setSchedule] = useState<ParentScheduleDraft>({
    courseId: "",
    occurrenceId: "",
    requestType: SCHEDULE_REQUEST_TYPES[1],
    reason: "",
    date: "",
    start: "",
    end: "",
  });
  // undefined selects the first report on arrival; null is an intentional closed detail.
  const [selectedReportId, setSelectedReportId] = useState<number | null | undefined>(undefined);
  const {user} = useRequiredAuth();

  const content = useQuery({
    queryKey: [
      "parent",
      studentUserId,
      "section",
      section,
      section === "notifications"
        ? notificationPage
        : section === "reports"
          ? reportPage
          : 0,
    ],
    enabled: studentUserId != null || section === "notifications",
    retry: false,
    queryFn: async () => {
      if (section === "notifications") {
        const [notifications, unread] = await Promise.all([
          parentApiService.listNotifications(notificationPage),
          parentApiService.getNotificationUnreadCount(),
        ]);
        return {
          notifications: unwrapData(notifications, "parentNotifications"),
          unread: unwrapData(unread, "parentNotificationUnreadCount"),
        };
      }
      if (studentUserId == null) throw new LocalizedError("learning:parent.noSelection");
      if (section === "dashboard")
        return unwrapData(
          await parentApiService.getStudentDashboard(studentUserId),
          "parentDashboard",
        );
      if (section === "learning") return null;
      if (section === "schedule") {
        const [calendar, requests] = await Promise.all([
          parentApiService.listStudentCalendar(studentUserId),
          parentApiService.listScheduleRequests(studentUserId),
        ]);
        return {
          calendar: unwrapData(calendar, "parentCalendar"),
          requests: unwrapData(requests, "parentScheduleRequests"),
        };
      }
      if (section === "reports")
        return unwrapData(
          await parentApiService.listStudentReports(studentUserId, reportPage),
          "parentReports",
        );
      if (section === "exams") return null;
      return null;
    },
  });

  const conversation = useInfiniteQuery({
    queryKey: ["parent", studentUserId, "messages"],
    enabled: studentUserId != null && section === "messages",
    queryFn: async ({ pageParam }) => {
      const data = unwrapData(
        await parentApiService.listConversationMessages(
          studentUserId!,
          pageParam,
        ),
        "parentMessages",
      );
      return Array.isArray(data) ? {items: data, hasMore: false, nextBeforeId: undefined} : data;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage, _pages, lastCursor) => {
      const next = lastPage.nextBeforeId;
      return lastPage.hasMore === true &&
        next != null &&
        Number.isFinite(next) &&
        (lastCursor == null || next < lastCursor)
        ? next
        : undefined;
    },
    retry: false,
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (studentUserId == null) throw new LocalizedError("learning:parent.noSelection");
      return sendStableMessage(
        idempotency,
        `parent-${studentUserId}`,
        { body: message.trim(), files: messageFiles },
        (draft, key) =>
          parentApiService.sendConversationMessage(studentUserId, draft, key),
      );
    },
    onSuccess: async () => {
      setMessage("");
      setMessageFiles([]);
      setFileInputKey((current) => current + 1);
      await queryClient.invalidateQueries({
        queryKey: ["parent", studentUserId, "messages"],
      });
    },
  });

  const markMessageRead = useMutation({
    mutationFn: (messageId: number) =>
      parentApiService.markConversationRead(studentUserId!, { messageId }),
    onSuccess: async () =>
      queryClient.invalidateQueries({
        queryKey: ["parent", studentUserId, "messages"],
      }),
  });
  const markNotificationRead = useMutation({
    mutationFn: (notificationId: number) =>
      parentApiService.markNotificationRead(notificationId),
    onSuccess: async () =>
      queryClient.invalidateQueries({
        queryKey: ["parent", studentUserId, "section", "notifications"],
      }),
  });
  const markAllNotificationsRead = useMutation({
    mutationFn: () => parentApiService.markAllNotificationsRead(),
    onSuccess: async () =>
      queryClient.invalidateQueries({
        queryKey: ["parent", studentUserId, "section", "notifications"],
      }),
  });
  const reportRows = section === "reports" ? recordItems(content.data) : [];
  const firstReportId = reportRows.length ? numberField(reportRows[0], 'reportId') : undefined;
  const activeReportId = selectedReportId === undefined ? firstReportId ?? null : selectedReportId;
  const reportDetail = useQuery({
    queryKey: ["parent", studentUserId, "report", activeReportId],
    queryFn: async () =>
      unwrapData(
        await parentApiService.getStudentReport(
          studentUserId!,
          activeReportId!,
        ),
        "parentReportDetail",
      ),
    enabled: section === "reports" && activeReportId != null,
    retry: false,
  });

  const createScheduleRequest = useMutation({
    mutationFn: async () => {
      if (studentUserId == null) throw new LocalizedError("learning:parent.noSelection");
      return idempotency.run(
        "parent-schedule-request",
        [
          studentUserId,
          {
            courseId: Number(schedule.courseId),
            occurrenceId: Number(schedule.occurrenceId),
            requestType: schedule.requestType,
            reason: schedule.reason || undefined,
            ...(schedule.requestType === SCHEDULE_REQUEST_TYPES[1]
              ? {
                  proposedOccurrenceDate: schedule.date || undefined,
                  proposedStartTime: schedule.start || undefined,
                  proposedEndTime: schedule.end || undefined,
                }
              : {}),
          },
        ] satisfies Parameters<typeof parentApiService.createScheduleRequest>,
        (key, args) => parentApiService.createScheduleRequest(...args, key),
      );
    },
    onSuccess: async () => {
      setSchedule({
        courseId: "",
        occurrenceId: "",
        requestType: SCHEDULE_REQUEST_TYPES[1],
        reason: "",
        date: "",
        start: "",
        end: "",
      });
      await queryClient.invalidateQueries({
        queryKey: ["parent", studentUserId, "section", "schedule"],
      });
    },
  });

  const openAttachment = async (
    attachmentId: number,
    preview: boolean,
    filename = translate('learning:messages.attachmentDownload'),
  ): Promise<void> => {
    setAttachmentError(undefined);
    setAttachmentBusy(attachmentId);
    const popup = preview ? openPreviewWindow() : null;
    try {
      if (preview) {
        if (!popup)
          throw new LocalizedError("operations:errors.attachmentPopups");
        showBlobInPreviewWindow(
          popup,
          await parentApiService.previewConversationAttachment(
            studentUserId,
            attachmentId,
          ),
        );
      } else
        saveBlob(
          await parentApiService.downloadConversationAttachment(
            studentUserId,
            attachmentId,
          ),
          filename,
        );
    } catch (error) {
      popup?.close();
      setAttachmentError(error);
    } finally {
      setAttachmentBusy(undefined);
    }
  };

  const contentRecord = isRecord(content.data) ? content.data : null;
  const messages: ParentConversationMessageResponse[] = [
    ...new Map(
      (conversation.data?.pages.flatMap((page) => page.items) ?? []).map(
        (item) => [item.messageId, item],
      ),
    ).values(),
  ].sort((a, b) => (a.messageId ?? 0) - (b.messageId ?? 0));
  const notificationData =
    section === "notifications" && contentRecord
      ? contentRecord.notifications
      : undefined;
  const notifications = recordItems(notificationData) as ParentNotification[];
  const notificationTotal = isRecord(notificationData)
    ? (numberField(notificationData, "total") ?? notifications.length)
    : notifications.length;
  return (
    <div className={`${styles.page} ${parentStyles.page}`}>
      <header className={parentStyles.pageHeader}>
        <div>
          <h1>{translate(PARENT_SECTIONS[section].label)}</h1>
          <p>{translate(PARENT_SECTIONS[section].description)}</p>
        </div>
      </header>
      <div className={parentStyles.studentContext}>
        <span className={parentStyles.studentIcon}><UserRound size={20} aria-hidden="true"/></span>
        {studentIds.length > 1 ? <label className={parentStyles.studentPicker}>
            <span className={parentStyles.visuallyHidden}>{translate("common:roles.STUDENT")}</span>
            <select
              aria-label={translate("common:roles.STUDENT")}
              name="studentUserId"
              autoComplete="off"
              value={studentUserId}
              disabled={
                sendMessage.isPending || createScheduleRequest.isPending
              }
              onChange={(event) => onStudentChange(Number(event.target.value))}
            >
              {studentIds.map((id) => (
                <option value={id} key={id}>
                  {formatPersonName(students.find(student => student.studentUserId === id), students.find(student => student.studentUserId === id)?.email || translate('common:people.studentFallback', {id: formatNumber(id)}))}
                </option>
              ))}
            </select>
            <ChevronDown size={17} aria-hidden="true"/>
          </label> : <strong>{formatPersonName(students.find(student => student.studentUserId === studentUserId), selectedStudent?.email || translate('common:people.studentFallback', {id: formatNumber(studentUserId)}))}</strong>}
        {selectedStudent?.email ? <><span className={parentStyles.studentDivider} aria-hidden="true">·</span><span>{selectedStudent?.email}</span></> : null}
      </div>

      {studentIds.length > 0 ? (
        <>
          {content.isError ||
          (section === "messages" && conversation.isError) ? (
            <div className={styles.conflictNotice} role="alert">
              <p>
                {advisingErrorMessage(
                  content.error || conversation.error,
                  translate('common:feedback.sectionFailed'),
                )}
              </p>
              <button
                type="button"
                className={styles.secondary}
                onClick={() =>
                  void (section === "messages"
                    ? conversation.refetch()
                    : content.refetch())
                }
              >
                {translate("common:actions.retry")}</button>
            </div>
          ) : null}
          <ParentSectionNav section={section} params={params}/>

          {section === "exams" && studentUserId != null ? <ParentMockExams key={studentUserId} studentUserId={studentUserId}/> : null}
          {section === 'schedule' ? <ParentSchedule
            value={content.data} history={params.get('tab') === 'requests'}
            loading={content.isPending} loadError={content.isError}
            draft={schedule} setDraft={setSchedule} pending={createScheduleRequest.isPending}
            error={createScheduleRequest.error} success={createScheduleRequest.isSuccess}
            onSubmit={() => createScheduleRequest.mutate()}
          /> : null}

          {section === "messages" ? <div className={parentStyles.messageGrid}>
            <WorkspaceSection title={translate("navigation:parent.conversation")} count={messages.length} className={parentStyles.messageThread}>
              {conversation.isPending ? (
                <p role="status">{translate("learning:messages.loading")}</p>
              ) : null}
              {attachmentError ? (
                <p role="alert" className={styles.error}>
                  {translate("learning:messages.attachmentFailed")}{" "}{advisingErrorMessage(attachmentError, '')}
                </p>
              ) : null}
              {conversation.isSuccess && messages.length === 0 ? (
                <div className={styles.emptyState}>
                  <MessageSquareText size={42} aria-hidden="true"/>
                  <strong>{translate("learning:messages.none")}</strong>
                  <span>{translate("learning:messages.noneHelp")}</span>
                </div>
              ) : (
                <div className={parentStyles.messageList}>
                  {messages.map((item, index) => (
                    <article
                      className={parentStyles.messageRow}
                      data-owner={item.senderUserId === user.userId ? 'parent' : 'advising'}
                      key={item.messageId ?? index}
                    >
                      <div className={styles.rowTitle}>
                        <strong>{item.senderUserId === user.userId ? translate("learning:messages.you") : translate("learning:messages.team")}</strong>
                        <span className={parentStyles.messageDirection}>{item.senderUserId === user.userId ? translate("learning:messages.sent") : translate("learning:messages.received")}</span>
                        <small>
                          {item.createdAt
                            ? formatNotificationTime(item.createdAt)
                            : ""}
                        </small>
                      </div>
                      <p>{item.body || translate("learning:messages.noText")}</p>
                      {(item.attachments?.length ?? 0) > 0 ? (
                        <div className={styles.attachmentList}>
                          {item.attachments?.map((attachment) =>
                            attachment.attachmentId == null ? null : (
                              <div
                                className={styles.attachmentRow}
                                key={attachment.attachmentId}
                              >
                                <span>
                                  {attachment.originalName || translate("operations:attachment")}
                                </span>
                                <div className={styles.actions}>
                                  {attachment.previewAvailable ? (
                                    <button
                                      type="button"
                                      className={styles.secondary}
                                      disabled={attachmentBusy != null}
                                      onClick={() =>
                                        void openAttachment(
                                          attachment.attachmentId!,
                                          true,
                                        )
                                      }
                                    >
                                      {translate("course:materials.preview")}</button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={styles.secondary}
                                    disabled={attachmentBusy != null}
                                    onClick={() =>
                                      void openAttachment(
                                        attachment.attachmentId!,
                                        false,
                                        attachment.originalName ||
                                          translate('learning:messages.attachmentDownload'),
                                      )
                                    }
                                  >
                                    {translate("common:actions.download")}</button>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      ) : null}
                      {item.messageId != null && item.senderUserId !== user.userId ? (
                        <button
                          type="button"
                          className={styles.textButton}
                          disabled={markMessageRead.isPending}
                          onClick={() =>
                            markMessageRead.mutate(item.messageId!)
                          }
                        >
                          {translate("learning:messages.markRead")}</button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
              {markMessageRead.isError ? (
                <p role="alert" className={styles.error}>
                  {advisingErrorMessage(
                    markMessageRead.error,
                    translate('learning:messages.readFailed'),
                  )}
                </p>
              ) : null}
              {conversation.hasNextPage ? (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={conversation.isFetchingNextPage}
                  onClick={() => void conversation.fetchNextPage()}
                >
                  {translate("learning:messages.older")}</button>
              ) : null}
            </WorkspaceSection>
            <WorkspaceSection title={translate("learning:messages.new")} className={parentStyles.messageComposerPanel}>
              <form
                noValidate
                className={`${styles.composeBox} ${parentStyles.messageComposer}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  if ((!message.trim() && messageFiles.length === 0) || sendMessage.isPending || !conversation.isSuccess) return;
                  sendMessage.mutate();
                }}
              >
                <label htmlFor="parent-message">{translate("operations:message")}</label>
                <div className={parentStyles.messageField}>
                  <textarea
                    maxLength={4000}
                    id="parent-message"
                    name="body"
                    autoComplete="off"
                    disabled={sendMessage.isPending}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={translate("learning:messages.placeholder")}
                  />
                  <span className={parentStyles.characterCount}>{formatNumber(message.length)} / {formatNumber(4000)}</span>
                </div>
                <span className={parentStyles.fieldLabel}>{translate("course:assignment.attachments")}</span>
                <label className={parentStyles.filePicker} htmlFor="parent-message-files">
                  <Paperclip size={24} aria-hidden="true"/>
                  <span><strong>{translate("learning:messages.addAttachments")}</strong><small>{translate("learning:messages.chooseFiles")}</small></span>
                </label>
                <input
                  className={parentStyles.visuallyHidden}
                  key={fileInputKey}
                  id="parent-message-files"
                  name="files"
                  type="file"
                  disabled={sendMessage.isPending}
                  multiple
                  onChange={(event) =>
                    setMessageFiles(Array.from(event.target.files ?? []))
                  }
                />
                {messageFiles.length > 0 ? (
                  <div className={styles.selectedFiles}>
                    {messageFiles.map((file, index) => (
                      <span key={`${file.name}-${file.lastModified}-${index}`}>
                        {file.name}
                        <button
                          type="button"
                          aria-label={translate('common:actions.removeItem', {item: file.name})}
                          disabled={sendMessage.isPending}
                          onClick={() =>
                            setMessageFiles((current) =>
                              current.filter(
                                (_, fileIndex) => fileIndex !== index,
                              ),
                            )
                          }
                        >
                          <X size={15} aria-hidden="true"/>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <button
                  className={styles.primary}
                  disabled={
                    (!message.trim() && messageFiles.length === 0) ||
                    sendMessage.isPending ||
                    !conversation.isSuccess
                  }
                >
                  {translate("assistant:send")}</button>
              </form>
              {sendMessage.isError ? (
                <p className={styles.error} role="alert">
                  {advisingErrorMessage(
                    sendMessage.error,
                    translate('learning:messages.sendFailed'),
                  )}
                </p>
              ) : null}
            </WorkspaceSection>
          </div> : null}

          {section === "reports" ? <ParentReports
            value={content.data}
            loading={content.isPending}
            listError={content.isError}
            page={reportPage}
            onPage={page => {setReportPage(page); setSelectedReportId(undefined);}}
            selectedId={activeReportId}
            onSelect={setSelectedReportId}
            detail={reportDetail.data}
            detailLoading={reportDetail.isFetching}
            detailError={reportDetail.error}
            onRetryDetail={() => void reportDetail.refetch()}
          /> : null}

          {section === "notifications" ? (
            <>
              <WorkspaceSection
                title={translate("navigation:parent.notifications")}
                className={styles.disclosureLayout}
              >
                <AdvisingPagination
                  label={translate("learning:messages.notificationPages")}
                  page={notificationPage}
                  total={notificationTotal}
                  onPage={setNotificationPage}
                />
                <div className={styles.sectionHeading}>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={
                      markAllNotificationsRead.isPending ||
                      notifications.length === 0
                    }
                    onClick={() => markAllNotificationsRead.mutate()}
                  >
                    {translate("notification:markAllRead")}</button>
                </div>
                {content.isPending ? (
                  <p role="status">{translate("notification:loading")}</p>
                ) : content.isError ? null : notifications.length === 0 ? (
                  <div className={styles.emptyState}>
                    <strong>{translate("learning:messages.noNotifications")}</strong>
                    <span>{translate("learning:messages.noNotificationsHelp")}</span>
                  </div>
                ) : (
                  <div className={styles.inboxList}>
                    {notifications.map((item, index) => (
                      <article
                        className={styles.inboxRow}
                        key={item.notificationId ?? index}
                      >
                        <div className={styles.inboxMain}>
                          <div className={styles.rowTitle}>
                            <strong>
                              {getNotificationTitle(item.notificationType)}
                            </strong>
                            {item.readAt ? (
                              <span className={styles.statusPill}>{translate("learning:messages.read")}</span>
                            ) : (
                              <span className={styles.unreadBadge}>{translate("dashboard:new")}</span>
                            )}
                          </div>
                          <span>{item.message || translate("notification:academicUpdate")}</span>
                          <small>
                            {[
                              item.courseCode,
                              item.createdAt
                                ? formatNotificationTime(item.createdAt)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </div>
                        {item.notificationId != null && !item.readAt ? (
                          <button
                            type="button"
                            className={styles.secondary}
                            disabled={markNotificationRead.isPending}
                            onClick={() =>
                              markNotificationRead.mutate(item.notificationId!)
                            }
                          >
                            {translate("learning:messages.markNotificationRead")}</button>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </WorkspaceSection>
              {markNotificationRead.isError ||
              markAllNotificationsRead.isError ? (
                <p role="alert" className={styles.error}>
                  {advisingErrorMessage(
                    markNotificationRead.error ||
                      markAllNotificationsRead.error,
                    translate('learning:messages.notificationsReadFailed'),
                  )}
                </p>
              ) : null}
            </>
          ) : null}

          {section === "dashboard" || section === "learning" ? (
            <>
              {content.isPending ? (
                <p role="status">{translate("learning:parent.loadingUpdates")}</p>
              ) : null}
              {content.isSuccess ? (
                section === 'dashboard' ? <ParentOverview value={content.data} params={params}/> :
                <ParentAcademicSections studentUserId={studentUserId} tab={learningTab}/>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

const ParentPortalPage: React.FC = () => {
  const {t: translate} = useTranslation();
  const linked = useLinkedStudents();
  const [params, setParams] = useSearchParams();
  const ids = [
    ...new Set(
      linkedStudentIds(linked.data).filter(
        (id) => Number.isSafeInteger(id) && id > 0,
      ),
    ),
  ];
  const requestedId = Number(params.get("studentUserId"));
  const selectedId = ids.includes(requestedId) ? requestedId : ids[0];
  if (selectedId != null)
    return (
      <ParentStudentWorkspace
        key={selectedId}
        studentUserId={selectedId}
        studentIds={ids}
        students={linked.data ?? []}
        onStudentChange={(id) =>
          setParams((current) => {
            const next = new URLSearchParams(current);
            next.set("studentUserId", String(id));
            return next;
          })
        }
      />
    );
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{translate("navigation:studentProgress")}</h1>
      </header>
      {linked.isPending ? (
        <p role="status">{translate("learning:parent.loadingStudents")}</p>
      ) : linked.isError ? (
        <div role="alert">
          <p>
            {advisingErrorMessage(
              linked.error,
              translate('learning:parent.studentsFailed'),
            )}
          </p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void linked.refetch()}
          >
            {translate("common:actions.retry")}</button>
        </div>
      ) : (
        <p className={styles.status}>
          {translate("learning:parent.noStudent")}</p>
      )}
    </div>
  );
};

export default ParentPortalPage;
