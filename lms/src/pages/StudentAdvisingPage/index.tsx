import React, {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import {isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import {advisorConversationMessageViews} from '../AdvisorOperationsPage/advisorViewModels';
import styles from '../advising/advising.module.scss';

const StudentAdvisingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [taskSubmissions, setTaskSubmissions] = useState<Record<number, string>>({});
  const [message, setMessage] = useState('');
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const profile = useQuery({
    queryKey: advisingQueryKeys.studentProfile,
    queryFn: async () => unwrapData(await advisorApiService.getOwnProfile(), 'studentProfile'),
    retry: false,
  });
  const plan = useQuery({
    queryKey: advisingQueryKeys.studentStudyPlan,
    queryFn: async () => unwrapData(await advisorApiService.getOwnStudyPlan(), 'studentStudyPlan'),
    retry: false,
  });
  const conversation = useQuery({
    queryKey: ['student', 'advisor-conversation'],
    queryFn: async () => unwrapData(await advisorApiService.listOwnConversationMessages(), 'studentAdvisorConversation'),
    retry: false,
  });
  const taskMutation = useMutation({
    mutationFn: ({action, taskId, version}: {action: 'start' | 'complete'; taskId: number; version?: number}) =>
      action === 'start'
        ? advisorApiService.startOwnAdvisorTask(taskId, {expectedVersion: version})
        : advisorApiService.completeOwnAdvisorTask(taskId, {expectedVersion: version, submissionText: taskSubmissions[taskId] || undefined}),
    onSuccess: async () => queryClient.invalidateQueries({queryKey: advisingQueryKeys.studentStudyPlan}),
  });
  const messageMutation = useMutation({
    mutationFn: () => {
      const clientMessageId = crypto.randomUUID();
      return messageFiles.length > 0
        ? advisorApiService.sendOwnConversationMessageMultipart({clientMessageId, body: message.trim() || undefined, files: messageFiles})
        : advisorApiService.sendOwnConversationMessage({clientMessageId, body: message.trim()});
    },
    onSuccess: async () => {
      setMessage('');
      setMessageFiles([]);
      setFileInputKey(current => current + 1);
      await queryClient.invalidateQueries({queryKey: ['student', 'advisor-conversation']});
    },
  });
  const markReadMutation = useMutation({mutationFn: (messageId: number) => advisorApiService.markOwnConversationRead({messageId})});

  const previewAttachment = async (attachmentId: number): Promise<void> => {
    const popup = openPreviewWindow();
    if (!popup) throw new Error('Allow pop-ups to preview this attachment.');
    try {
      const blob = await advisorApiService.previewOwnConversationAttachment(attachmentId);
      showBlobInPreviewWindow(popup, blob);
    } catch (error) {
      popup.close();
      throw error;
    }
  };
  const conversationRows = advisorConversationMessageViews(conversation.data);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Student</p>
          <h1>My advising record</h1>
          <p className={styles.lede}>Read-only. Your advisor maintains the profile and study plan.</p>
        </div>
      </header>
      <section className={styles.card}>
        <h2>Profile</h2>
        {profile.isPending ? <p className={styles.status}>Loading profile…</p> : null}
        {profile.isError && isNotFound(profile.error) ? <p className={styles.status}>Your advisor has not created a profile yet.</p> : null}
        {profile.isError && !isNotFound(profile.error) ? <p className={styles.error} role="alert">{advisingErrorMessage(profile.error, 'Profile could not be loaded.')}</p> : null}
        {profile.data ? (
          <dl className={styles.readonly}>
            <dt>Name</dt><dd>{profile.data.name}</dd>
            <dt>Goal</dt><dd>{profile.data.targetGoal || '—'}</dd>
            <dt>Target</dt><dd>{[profile.data.targetMetric, profile.data.targetValue, profile.data.targetDate].filter(Boolean).join(' · ') || '—'}</dd>
            <dt>Skills</dt>
            <dd>
              {(profile.data.skills ?? []).map(skill => (
                <div key={skill.skillCode}>{skill.displayName}: {skill.currentValue || '—'} → {skill.targetValue || '—'}</div>
              ))}
            </dd>
          </dl>
        ) : null}
        {'advisorPrivateNotes' in (profile.data ?? {}) ? <p className={styles.error}>Private notes leaked into the student view.</p> : null}
      </section>
      <section className={styles.card}>
        <h2>Study plan</h2>
        {plan.isPending ? <p className={styles.status}>Loading study plan…</p> : null}
        {plan.isError && isNotFound(plan.error) ? <p className={styles.status}>Your advisor has not created a study plan yet.</p> : null}
        {plan.isError && !isNotFound(plan.error) ? <p className={styles.error} role="alert">{advisingErrorMessage(plan.error, 'Study plan could not be loaded.')}</p> : null}
        {plan.data ? (
          <div>
            <p>{plan.data.plan.strategySummary}</p>
            <p className={styles.muted}>{plan.data.plan.startDate} – {plan.data.plan.planEndDate} · version {plan.data.plan.studyPlanVersion}</p>
            {(plan.data.plan.checkpoints ?? []).map(checkpoint => (
              <article key={checkpoint.id ?? checkpoint.position} className={styles.nested}>
                <strong>{checkpoint.description}</strong>
                <p>{checkpoint.goal}</p>
                <p className={styles.muted}>Due {checkpoint.dueDate}</p>
                {(checkpoint.tasks ?? []).map(task => (
                  <div key={task.id ?? task.position} className={styles.nested}>
                    <strong>{task.title || 'Advisor task'}</strong>
                    <p className={styles.muted}>{task.dueDate ? `Due ${task.dueDate} · ` : ''}{task.status || 'Not started'}</p>
                    {task.id != null && task.status !== 'COMPLETED' ? (
                      <>
                        <label className={styles.form}>
                          Submission note
                          <textarea value={taskSubmissions[task.id] ?? ''} onChange={event => setTaskSubmissions(current => ({...current, [task.id!]: event.target.value}))}/>
                        </label>
                        <div className={styles.actions}>
                          <button type="button" className={styles.secondary} onClick={() => taskMutation.mutate({action: 'start', taskId: task.id!, version: task.version})}>Start</button>
                          <button type="button" className={styles.primary} onClick={() => taskMutation.mutate({action: 'complete', taskId: task.id!, version: task.version})}>Complete</button>
                        </div>
                      </>
                    ) : null}
                    {task.advisorFeedback ? <p>Advisor feedback: {task.advisorFeedback}</p> : null}
                  </div>
                ))}
              </article>
            ))}
          </div>
        ) : null}
      </section>
      {taskMutation.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(taskMutation.error, 'The task could not be updated.')}</p> : null}
      <section className={styles.card}>
        <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Study support</p><h2>Advisor conversation</h2></div><span className={styles.countBadge}>{conversationRows.length}</span></div>
        {messageMutation.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(messageMutation.error, 'Message could not be sent.')}</p> : null}
        {conversation.isPending ? <p className={styles.status}>Loading messages…</p> : null}
        {conversation.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(conversation.error, 'Messages could not be loaded.')}</p> : null}
        {!conversation.isPending && conversationRows.length === 0 ? <div className={styles.emptyState}><strong>No messages yet</strong><span>Send a message or attachment to start the conversation.</span></div> : null}
        <div className={styles.messageList}>{conversationRows.map((item, index) => <article className={styles.messageRow} key={item.messageId ?? index}>
          <div className={styles.rowTitle}><strong>{item.senderUserId == null ? 'Conversation message' : `User #${item.senderUserId}`}</strong><small>{item.createdAt || ''}</small></div>
          <p>{item.body || 'Message has no text content.'}</p>
          {(item.attachments?.length ?? 0) > 0 ? <div className={styles.attachmentList}>{item.attachments?.map(attachment => attachment.attachmentId == null ? null : <div className={styles.attachmentRow} key={attachment.attachmentId}>
            <span>{attachment.originalName || `Attachment #${attachment.attachmentId}`}</span>
            <div className={styles.actions}>{attachment.previewAvailable ? <button type="button" className={styles.secondary} onClick={() => void previewAttachment(attachment.attachmentId!)}>Preview</button> : null}<button type="button" className={styles.secondary} onClick={() => void advisorApiService.downloadOwnConversationAttachment(attachment.attachmentId!).then(blob => saveBlob(blob, attachment.originalName || `advisor-attachment-${attachment.attachmentId}`))}>Download</button></div>
          </div>)}</div> : null}
          {item.messageId != null ? <button type="button" className={styles.textButton} disabled={markReadMutation.isPending} onClick={() => markReadMutation.mutate(item.messageId!)}>Mark read through this message</button> : null}
        </article>)}</div>
        <form className={styles.composeBox} onSubmit={event => { event.preventDefault(); messageMutation.mutate(); }}>
          <label htmlFor="student-advisor-message">Message</label><textarea id="student-advisor-message" value={message} onChange={event => setMessage(event.target.value)} placeholder="Write to your advisor…"/>
          <label htmlFor="student-advisor-files">Attachments</label><input key={fileInputKey} id="student-advisor-files" type="file" multiple onChange={event => setMessageFiles(Array.from(event.target.files ?? []))}/>
          {messageFiles.length > 0 ? <div className={styles.selectedFiles}>{messageFiles.map((file, index) => <span key={`${file.name}-${file.lastModified}-${index}`}>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setMessageFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></span>)}</div> : null}
          <button className={styles.primary} disabled={(!message.trim() && messageFiles.length === 0) || messageMutation.isPending}>Send message</button>
        </form>
      </section>
    </main>
  );
};

export default StudentAdvisingPage;
