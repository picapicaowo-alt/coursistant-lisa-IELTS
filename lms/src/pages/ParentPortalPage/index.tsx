import { AdvisingPagination } from "../advising/AdvisingPagination";
import { WorkspaceSection } from "@/components/WorkspaceSection";
import { ObserverMockExams } from "@/components/ObserverMockExams";
import { useIdempotencyCheckpoint } from "@/hooks/useIdempotencyCheckpoint";
import { sendStableMessage } from "@/utils/sendStableMessage";
import {
  getNotificationTitle,
  formatNotificationTime,
} from "@/utils/notificationPresentation";
import {
  EnglishDateInput,
  EnglishTimeInput,
} from "@/components/EnglishDateInput";
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLinkedStudents } from "./useLinkedStudents";
import { ParentAcademicSections } from "./ParentAcademicSections";
import parentStyles from "./index.module.scss";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { RecordSummaryList } from "@/components/RecordSummaryList";
import {
  SCHEDULE_REQUEST_TYPES,
  unwrapData,
  type ParentConversationMessageResponse,
  type ParentNotification,
} from "@/apis";
import { parentApiService } from "@/apis/services/parent-api";
import { advisingErrorMessage } from "../advising/advisingErrors";
import styles from "../advising/advising.module.scss";
import {
  openPreviewWindow,
  saveBlob,
  showBlobInPreviewWindow,
} from "@/utils/downloadBlob";

type ParentSection =
  | "dashboard"
  | "learning"
  | "schedule"
  | "reports"
  | "exams"
  | "messages"
  | "notifications";

const SECTIONS: Array<{ id: ParentSection; label: string }> = [
  { id: "dashboard", label: "Overview" },
  { id: "learning", label: "Learning" },
  { id: "schedule", label: "Schedule" },
  { id: "reports", label: "Reports" },
  { id: "exams", label: "Mock exams" },
  { id: "messages", label: "Messages" },
  { id: "notifications", label: "Notifications" },
];

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

const textField = (
  record: Record<string, unknown>,
  ...keys: string[]
): string | undefined => {
  for (const key of keys)
    if (typeof record[key] === "string" && (record[key] as string).trim())
      return record[key] as string;
  return undefined;
};

const ParentStudentWorkspace: React.FC<{
  studentUserId: number;
  studentIds: number[];
  onStudentChange: (id: number) => void;
}> = ({ studentUserId, studentIds, onStudentChange }) => {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [notificationPage, setNotificationPage] = useState(0);
  const [params, setParams] = useSearchParams();
  const section =
    SECTIONS.find((item) => item.id === params.get("section"))?.id ??
    "dashboard";
  const setSection = (section: ParentSection) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("section", section);
      return next;
    });
  const [reportPage, setReportPage] = useState(0);
  const [attachmentError, setAttachmentError] = useState<unknown>();
  const [attachmentBusy, setAttachmentBusy] = useState<number>();
  const [message, setMessage] = useState("");
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [schedule, setSchedule] = useState({
    courseId: "",
    occurrenceId: "",
    requestType: String(SCHEDULE_REQUEST_TYPES[1]),
    reason: "",
    date: "",
    start: "",
    end: "",
  });
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

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
      if (studentUserId == null) throw new Error("No linked student selected");
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
      // The live endpoint returns a cursor page; older contracts also returned arrays.
      return Array.isArray(data)
        ? {
            items: data,
            nextBeforeId: data.length
              ? Math.min(
                  ...data.flatMap((item) =>
                    item.messageId == null ? [] : [item.messageId],
                  ),
                )
              : undefined,
          }
        : data;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage, _pages, lastCursor) => {
      const next = lastPage.nextBeforeId;
      return lastPage.hasMore !== false &&
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
      if (studentUserId == null) throw new Error("No linked student selected");
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
  const reportDetail = useQuery({
    queryKey: ["parent", studentUserId, "report", selectedReportId],
    queryFn: async () =>
      unwrapData(
        await parentApiService.getStudentReport(
          studentUserId!,
          selectedReportId!,
        ),
        "parentReportDetail",
      ),
    enabled: section === "reports" && selectedReportId != null,
    retry: false,
  });

  const createScheduleRequest = useMutation({
    mutationFn: async () => {
      if (studentUserId == null) throw new Error("No linked student selected");
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
        requestType: String(SCHEDULE_REQUEST_TYPES[1]),
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
    filename = "conversation-attachment",
  ): Promise<void> => {
    setAttachmentError(undefined);
    setAttachmentBusy(attachmentId);
    const popup = preview ? openPreviewWindow() : null;
    try {
      if (preview) {
        if (!popup)
          throw new Error("Allow pop-ups to preview this attachment.");
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
  const reportRows = section === "reports" ? recordItems(content.data) : [];
  const calendarRows =
    section === "schedule" && contentRecord
      ? recordItems(contentRecord.calendar)
      : [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Student progress</h1>
          <p className={styles.lede}>
            Read academic updates, request schedule changes, and contact the
            advising team.
          </p>
        </div>
        {studentIds.length > 1 ? (
          <label className={styles.form}>
            Student
            <select
              value={studentUserId}
              disabled={
                sendMessage.isPending || createScheduleRequest.isPending
              }
              onChange={(event) => onStudentChange(Number(event.target.value))}
            >
              {studentIds.map((id) => (
                <option value={id} key={id}>
                  Student #{id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      {studentIds.length > 0 ? (
        <>
          {content.isError ||
          (section === "messages" && conversation.isError) ? (
            <div className={styles.conflictNotice} role="alert">
              <p>
                {advisingErrorMessage(
                  content.error || conversation.error,
                  "This section could not be loaded.",
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
                Retry
              </button>
            </div>
          ) : null}
          <nav
            className={parentStyles.tabs}
            aria-label="Parent portal sections"
          >
            {SECTIONS.map((item) => (
              <button
                type="button"
                aria-current={item.id === section ? "page" : undefined}
                key={item.id}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {section === "exams" && studentUserId != null ? (
            <WorkspaceSection
              title="Assigned mock exams"
              className={styles.disclosureLayout}
              summary="Review completed sections and published scores."
            >
              <ObserverMockExams
                key={studentUserId}
                scope="parent"
                studentUserId={studentUserId}
              />
            </WorkspaceSection>
          ) : null}
          {section === "schedule" ? (
            <WorkspaceSection
              title="Request a schedule change"
              className={styles.disclosureLayout}
            >
              {content.isPending ? (
                <p role="status">Loading scheduled classes…</p>
              ) : content.isError ? null : calendarRows.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>No upcoming class can be changed</strong>
                  <span>
                    Schedule actions appear beside available calendar
                    occurrences.
                  </span>
                </div>
              ) : (
                <div className={styles.inboxList}>
                  {calendarRows.map((row, index) => {
                    const courseId = numberField(row, "courseId");
                    const occurrenceId = numberField(
                      row,
                      "occurrenceId",
                      "sessionOccurrenceId",
                    );
                    const selected =
                      String(courseId) === schedule.courseId &&
                      String(occurrenceId) === schedule.occurrenceId;
                    return (
                      <article
                        className={styles.inboxRow}
                        key={occurrenceId ?? index}
                      >
                        <div className={styles.inboxMain}>
                          <strong>
                            {textField(
                              row,
                              "courseTitle",
                              "courseCode",
                              "title",
                            ) || "Scheduled class"}
                          </strong>
                          <span>
                            {[
                              textField(row, "occurrenceDate", "date"),
                              textField(row, "startTime"),
                              textField(row, "location"),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        {courseId != null && occurrenceId != null ? (
                          <button
                            type="button"
                            className={
                              selected ? styles.primary : styles.secondary
                            }
                            onClick={() =>
                              setSchedule((current) => ({
                                ...current,
                                courseId: String(courseId),
                                occurrenceId: String(occurrenceId),
                              }))
                            }
                          >
                            {selected ? "Selected" : "Request change"}
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
              {schedule.courseId && schedule.occurrenceId ? (
                <form
                  className={styles.reviewPanel}
                  onSubmit={(event) => {
                    event.preventDefault();
                    createScheduleRequest.mutate();
                  }}
                >
                  <strong>Selected scheduled class</strong>
                  <label>
                    Request type
                    <select
                      value={schedule.requestType}
                      onChange={(event) =>
                        setSchedule((current) => ({
                          ...current,
                          requestType: event.target.value,
                        }))
                      }
                    >
                      {SCHEDULE_REQUEST_TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  {schedule.requestType === SCHEDULE_REQUEST_TYPES[1] ? (
                    <div className={styles.formGrid}>
                      <label>
                        Proposed date
                        <EnglishDateInput
                          required
                          value={schedule.date}
                          onChangeValue={(date) =>
                            setSchedule((current) => ({ ...current, date }))
                          }
                        />
                      </label>
                      <label>
                        Starts
                        <EnglishTimeInput
                          required
                          value={schedule.start}
                          onChangeValue={(start) =>
                            setSchedule((current) => ({ ...current, start }))
                          }
                        />
                      </label>
                      <label>
                        Ends
                        <EnglishTimeInput
                          required
                          value={schedule.end}
                          onChangeValue={(end) =>
                            setSchedule((current) => ({ ...current, end }))
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                  <label>
                    Reason
                    <textarea
                      value={schedule.reason}
                      onChange={(event) =>
                        setSchedule((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    className={styles.primary}
                    disabled={createScheduleRequest.isPending}
                  >
                    Submit request
                  </button>
                </form>
              ) : null}
              {createScheduleRequest.isError ? (
                <p className={styles.error} role="alert">
                  {advisingErrorMessage(
                    createScheduleRequest.error,
                    "Schedule request could not be submitted.",
                  )}
                </p>
              ) : null}
              {contentRecord?.requests !== undefined ? (
                <div className={styles.compactResult}>
                  <RecordSummaryList
                    value={contentRecord.requests}
                    emptyMessage="No schedule requests have been submitted."
                  />
                </div>
              ) : null}
            </WorkspaceSection>
          ) : null}

          {section === "messages" ? (
            <WorkspaceSection
              title="Conversation"
              className={styles.disclosureLayout}
              meta={
                <span className={styles.countBadge}>{messages.length}</span>
              }
            >
              {conversation.isPending ? (
                <p role="status">Loading messages…</p>
              ) : null}
              {attachmentError ? (
                <p role="alert" className={styles.error}>
                  The attachment could not be opened. Please try again.
                  {" "}{advisingErrorMessage(attachmentError, '')}
                </p>
              ) : null}
              {conversation.isSuccess && messages.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>No messages yet</strong>
                  <span>Start the conversation below.</span>
                </div>
              ) : (
                <div className={styles.messageList}>
                  {messages.map((item, index) => (
                    <article
                      className={styles.messageRow}
                      key={item.messageId ?? index}
                    >
                      <div className={styles.rowTitle}>
                        <strong>
                          {item.senderUserId == null
                            ? "Conversation message"
                            : `User #${item.senderUserId}`}
                        </strong>
                        <small>
                          {item.createdAt
                            ? formatNotificationTime(item.createdAt)
                            : ""}
                        </small>
                      </div>
                      <p>{item.body || "Message has no text content."}</p>
                      {(item.attachments?.length ?? 0) > 0 ? (
                        <div className={styles.attachmentList}>
                          {item.attachments?.map((attachment) =>
                            attachment.attachmentId == null ? null : (
                              <div
                                className={styles.attachmentRow}
                                key={attachment.attachmentId}
                              >
                                <span>
                                  {attachment.originalName || "Attachment"}
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
                                      Preview
                                    </button>
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
                                          "conversation-attachment",
                                      )
                                    }
                                  >
                                    Download
                                  </button>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      ) : null}
                      {item.messageId != null ? (
                        <button
                          type="button"
                          className={styles.textButton}
                          disabled={markMessageRead.isPending}
                          onClick={() =>
                            markMessageRead.mutate(item.messageId!)
                          }
                        >
                          Mark read through this message
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
              {markMessageRead.isError ? (
                <p role="alert" className={styles.error}>
                  {advisingErrorMessage(
                    markMessageRead.error,
                    "The message could not be marked as read.",
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
                  Load older messages
                </button>
              ) : null}
              <form
                className={styles.composeBox}
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage.mutate();
                }}
              >
                <label htmlFor="parent-message">Message</label>
                <textarea
                  maxLength={4000}
                  id="parent-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write to the advising team…"
                />
                <label htmlFor="parent-message-files">Attachments</label>
                <input
                  key={fileInputKey}
                  id="parent-message-files"
                  type="file"
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
                          aria-label={`Remove ${file.name}`}
                          onClick={() =>
                            setMessageFiles((current) =>
                              current.filter(
                                (_, fileIndex) => fileIndex !== index,
                              ),
                            )
                          }
                        >
                          ×
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
                  Send message
                </button>
              </form>
              {sendMessage.isError ? (
                <p className={styles.error} role="alert">
                  {advisingErrorMessage(
                    sendMessage.error,
                    "Message could not be sent.",
                  )}
                </p>
              ) : null}
            </WorkspaceSection>
          ) : null}

          {section === "reports" ? (
            <WorkspaceSection
              title="Reports"
              className={styles.disclosureLayout}
              meta={
                <span className={styles.countBadge}>{reportRows.length}</span>
              }
            >
              <AdvisingPagination
                label="Report pages"
                page={reportPage}
                total={
                  contentRecord
                    ? (numberField(contentRecord, "total") ?? reportRows.length)
                    : reportRows.length
                }
                onPage={(page) => {
                  setReportPage(page);
                  setSelectedReportId(null);
                }}
              />
              {reportDetail.isFetching ? (
                <p role="status">Loading report…</p>
              ) : null}
              {reportDetail.isError ? (
                <p role="alert" className={styles.error}>
                  {advisingErrorMessage(
                    reportDetail.error,
                    "The report could not be loaded.",
                  )}{" "}
                  <button
                    type="button"
                    onClick={() => void reportDetail.refetch()}
                  >
                    Retry
                  </button>
                </p>
              ) : null}
              {content.isPending ? (
                <p role="status">Loading reports…</p>
              ) : content.isError ? null : reportRows.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>No published reports</strong>
                  <span>Published learning reports will appear here.</span>
                </div>
              ) : (
                <div className={styles.inboxList}>
                  {reportRows.map((row, index) => {
                    const reportId = numberField(row, "reportId");
                    return (
                      <article
                        className={styles.inboxRow}
                        key={reportId ?? index}
                      >
                        <div className={styles.inboxMain}>
                          <strong>
                            {textField(row, "reportType", "title") ||
                              "Learning report"}
                          </strong>
                          <span>
                            {textField(row, "overallSummary", "summary") ||
                              textField(row, "publishedAt") ||
                              "Published report"}
                          </span>
                        </div>
                        {reportId != null ? (
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => setSelectedReportId(reportId)}
                          >
                            Open report
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
              {reportDetail.data ? (
                <div className={styles.reportDetail}>
                  <h3>{reportDetail.data.reportType || "Report detail"}</h3>
                  <p>{reportDetail.data.overallSummary}</p>
                  {reportDetail.data.strengths ? (
                    <p>
                      <strong>Strengths</strong>
                      <br />
                      {reportDetail.data.strengths}
                    </p>
                  ) : null}
                  {reportDetail.data.improvementSuggestions ? (
                    <p>
                      <strong>Next steps</strong>
                      <br />
                      {reportDetail.data.improvementSuggestions}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </WorkspaceSection>
          ) : null}

          {section === "notifications" ? (
            <>
              <WorkspaceSection
                title="Notifications"
                className={styles.disclosureLayout}
              >
                <AdvisingPagination
                  label="Notification pages"
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
                    Mark all read
                  </button>
                </div>
                {content.isPending ? (
                  <p role="status">Loading notifications…</p>
                ) : content.isError ? null : notifications.length === 0 ? (
                  <div className={styles.emptyState}>
                    <strong>No notifications</strong>
                    <span>New academic updates will appear here.</span>
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
                              <span className={styles.statusPill}>Read</span>
                            ) : (
                              <span className={styles.unreadBadge}>New</span>
                            )}
                          </div>
                          <span>{item.message || "Academic update"}</span>
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
                            Mark read
                          </button>
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
                    "Notifications could not be marked as read.",
                  )}
                </p>
              ) : null}
            </>
          ) : null}

          {section === "dashboard" || section === "learning" ? (
            <>
              {content.isPending ? (
                <p role="status">Loading academic updates…</p>
              ) : null}
              {content.isSuccess ? (
                <ParentAcademicSections
                  value={content.data}
                  learning={section === "learning"}
                  studentUserId={studentUserId}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

const ParentPortalPage: React.FC = () => {
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
        <h1>Student progress</h1>
      </header>
      {linked.isPending ? (
        <p role="status">Loading linked students…</p>
      ) : linked.isError ? (
        <div role="alert">
          <p>
            {advisingErrorMessage(
              linked.error,
              "Linked students could not be loaded.",
            )}
          </p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void linked.refetch()}
          >
            Retry
          </button>
        </div>
      ) : (
        <p className={styles.status}>
          No active student link is available for this account.
        </p>
      )}
    </div>
  );
};

export default ParentPortalPage;
