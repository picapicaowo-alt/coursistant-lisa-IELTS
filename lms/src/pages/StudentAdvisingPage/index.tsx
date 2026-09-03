import {CollapsibleSection} from '@/components/CollapsibleSection';
import React, {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {CheckpointWorkspace} from './CheckpointWorkspace';
import checkpointStyles from './CheckpointWorkspace.module.scss';
import {STUDY_PLAN_PARAMS, studyPlanRecordKey, type TaskAction} from './studyPlanView';
import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {sendStableMessage} from '@/utils/sendStableMessage';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import {isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import {advisorConversationMessageViews} from '../AdvisorOperationsPage/advisorViewModels';
import styles from '../advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';

const StudentAdvisingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const idempotency = useIdempotencyCheckpoint();
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
  const conversation = useInfiniteQuery({
    queryKey: ['student', 'advisor-conversation'],
    queryFn: async ({pageParam}) => advisorConversationMessageViews(unwrapData(await advisorApiService.listOwnConversationMessages(pageParam), 'studentAdvisorConversation')),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: lastPage => {
      const ids = lastPage.flatMap(item => item.messageId == null ? [] : [item.messageId]);
      return ids.length ? Math.min(...ids) : undefined;
    },
    retry: false,
  });
  const taskMutation = useMutation({
    mutationFn: ({action, taskId, version}: TaskAction) =>
      action === 'start'
        ? idempotency.run('student-start-task', [taskId, {expectedVersion: version}] satisfies Parameters<typeof advisorApiService.startOwnAdvisorTask>, (key, args) => advisorApiService.startOwnAdvisorTask(...args, key))
        : idempotency.run('student-complete-task', [taskId, {expectedVersion: version, submissionText: taskSubmissions[taskId] ?? plan.data?.plan.checkpoints?.flatMap(checkpoint => checkpoint.tasks ?? []).find(task => task.id === taskId)?.submissionText}] satisfies Parameters<typeof advisorApiService.completeOwnAdvisorTask>, (key, args) => advisorApiService.completeOwnAdvisorTask(...args, key)),
    onSuccess: async () => queryClient.invalidateQueries({queryKey: advisingQueryKeys.studentStudyPlan}),
  });
  const messageMutation = useMutation({
    mutationFn: () => {
      if (messageFiles.some(file => file.type.startsWith('audio/'))) throw new Error('Audio attachments are not supported.');
      return sendStableMessage(idempotency, 'student-advisor', {body: message.trim(), files: messageFiles}, (draft, key) => draft.files.length
        ? advisorApiService.sendOwnConversationMessageMultipart(draft, key)
        : advisorApiService.sendOwnConversationMessage({clientMessageId: draft.clientMessageId, body: draft.body}, key));
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
  const conversationRows = conversation.data?.pages.flat() ?? [];
  const checkpointKey = searchParams.get(STUDY_PLAN_PARAMS.checkpoint);
  const checkpointIndex = plan.data?.plan.checkpoints?.findIndex((checkpoint, index) => studyPlanRecordKey(checkpoint, index) === checkpointKey) ?? -1;
  const checkpoint = checkpointIndex >= 0 ? plan.data?.plan.checkpoints?.[checkpointIndex] : undefined;
  const backToPlan = () => {
    const next = new URLSearchParams(searchParams);
    next.delete(STUDY_PLAN_PARAMS.checkpoint);
    next.delete(STUDY_PLAN_PARAMS.task);
    setSearchParams(next);
    if (!taskMutation.isPending) taskMutation.reset();
  };
  const openCheckpoint = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(STUDY_PLAN_PARAMS.checkpoint, key);
    next.delete(STUDY_PLAN_PARAMS.task);
    setSearchParams(next);
  };

  if (checkpointKey) return <div className={checkpointStyles.page}>
    {checkpoint ? <CheckpointWorkspace key={checkpointKey} checkpoint={checkpoint} index={checkpointIndex} onBack={backToPlan}
      submissions={taskSubmissions} onSubmission={(taskId, value) => setTaskSubmissions(current => ({...current, [taskId]: value}))}
      onAction={action => taskMutation.mutate(action)} isPending={taskMutation.isPending} actionTaskId={taskMutation.variables?.taskId} onClearError={() => {if (!taskMutation.isPending) taskMutation.reset();}}
      error={taskMutation.isError ? advisingErrorMessage(taskMutation.error, 'The task could not be updated. Please try again.') : undefined}/>
      : <section className={styles.editorPage}><button type="button" className={styles.secondary} onClick={backToPlan}>Back to study plan</button>
        {plan.isPending ? <p className={styles.status}>Loading checkpoint…</p> : <p className={plan.isError ? styles.error : styles.status} role={plan.isError ? 'alert' : undefined}>{plan.isError ? advisingErrorMessage(plan.error, 'The study plan could not be loaded.') : 'This checkpoint is no longer in your current study plan.'}</p>}
        {plan.isError ? <button type="button" className={styles.secondary} onClick={() => void plan.refetch()}>Try again</button> : null}
      </section>}
  </div>;


  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Study plan</h1>
          <p className={styles.lede}>Your goals, checkpoints, and next steps.</p>
        </div>
      </header>
      <CollapsibleSection title="Learning profile" className={styles.disclosureLayout} summary="Your current goal and the skills being measured." meta={<span className={styles.readOnlyBadge}>Read only</span>}>

        {profile.isPending ? <p className={styles.status}>Loading profile…</p> : null}
        {profile.isError && isNotFound(profile.error) ? <p className={styles.status}>Your advisor has not created a profile yet.</p> : null}
        {profile.isError && !isNotFound(profile.error) ? <p className={styles.error} role="alert">{advisingErrorMessage(profile.error, 'Profile could not be loaded.')}</p> : null}
        {profile.data ? (
          <>
            <CollapsibleSection title="Primary target" headingLevel={3} summary={profile.data.targetGoal || 'Goal and target date'}><dl className={styles.summaryGrid}>
              <div className={styles.summaryItem}><dt>Name</dt><dd>{formatPersonName(profile.data, '—')}</dd></div>
              <div className={styles.summaryItem}><dt>Primary target</dt><dd>{[profile.data.targetMetric, profile.data.targetValue, profile.data.targetDate].filter(Boolean).join(' · ') || '—'}</dd></div>
              <div className={`${styles.summaryItem} ${styles.spanTwo}`}><dt>Goal</dt><dd>{profile.data.targetGoal || '—'}</dd></div>
            </dl></CollapsibleSection>
            {(profile.data.skills ?? []).length > 0 ? <CollapsibleSection title="Measured skills" headingLevel={3} count={profile.data.skills?.length}><div className={styles.skillSummary}>{(profile.data.skills ?? []).map(skill => (
              <CollapsibleSection title={skill.displayName || skill.skillCode || 'Measured skill'} headingLevel={4} key={skill.skillCode} summary={skill.scale}>
                <div className={styles.metaRow}><span>{skill.scale || 'Scale not specified'}</span><span>Current {skill.currentValue || '—'}</span><span>Target {skill.targetValue || '—'}</span></div>
                {skill.gapSummary ? <p>{skill.gapSummary}</p> : null}
              </CollapsibleSection>
            ))}</div></CollapsibleSection> : null}
          </>
        ) : null}
      </CollapsibleSection>
      <CollapsibleSection title="Study plan" className={styles.disclosureLayout} summary="Follow the plan one checkpoint at a time. Tasks can be started and completed here." meta={plan.data ? <span className={styles.versionBadge}>Version {plan.data.plan.studyPlanVersion}</span> : undefined}>

        {plan.isPending ? <p className={styles.status}>Loading study plan…</p> : null}
        {plan.isError && isNotFound(plan.error) ? <p className={styles.status}>Your advisor has not created a study plan yet.</p> : null}
        {plan.isError && !isNotFound(plan.error) ? <p className={styles.error} role="alert">{advisingErrorMessage(plan.error, 'Study plan could not be loaded.')}</p> : null}
        {plan.data ? (
          <div className={styles.checkpointList}>
            <div className={styles.summaryItem}><strong>{plan.data.plan.strategySummary}</strong><span className={styles.muted}>{plan.data.plan.startDate} – {plan.data.plan.planEndDate}</span></div>
            {(plan.data.plan.checkpoints ?? []).map((checkpoint, checkpointIndex) => (
              <CollapsibleSection key={checkpoint.id ?? checkpoint.position} title={`Checkpoint ${checkpointIndex + 1}: ${checkpoint.description}`} headingLevel={3} summary={checkpoint.goal}>
                <div className={styles.metaRow}><span>Due {checkpoint.dueDate || 'date not set'}</span><span>{(checkpoint.tasks ?? []).length} task{(checkpoint.tasks ?? []).length === 1 ? '' : 's'}</span></div>
                <button type="button" className={styles.primary} onClick={() => openCheckpoint(studyPlanRecordKey(checkpoint, checkpointIndex))}>View tasks</button>
              </CollapsibleSection>
            ))}
          </div>
        ) : null}
      </CollapsibleSection>
      {taskMutation.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(taskMutation.error, 'The task could not be updated.')}</p> : null}
      <CollapsibleSection title="Advisor conversation" className={styles.disclosureLayout} summary="Ask questions, share context, or attach supporting files." meta={<span className={styles.countBadge}>{conversationRows.length}</span>}>

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
        {conversation.hasNextPage ? <button type="button" className={styles.secondary} disabled={conversation.isFetchingNextPage} onClick={() => void conversation.fetchNextPage()}>Load older messages</button> : null}
        <form className={styles.composeBox} onSubmit={event => { event.preventDefault(); messageMutation.mutate(); }}>
          <label htmlFor="student-advisor-message">Message</label><textarea id="student-advisor-message" value={message} onChange={event => setMessage(event.target.value)} placeholder="Write to your advisor…"/>
          <label htmlFor="student-advisor-files">Attachments</label><input key={fileInputKey} id="student-advisor-files" type="file" multiple onChange={event => setMessageFiles(Array.from(event.target.files ?? []))}/>
          {messageFiles.length > 0 ? <div className={styles.selectedFiles}>{messageFiles.map((file, index) => <span key={`${file.name}-${file.lastModified}-${index}`}>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setMessageFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></span>)}</div> : null}
          <button className={styles.primary} disabled={(!message.trim() && messageFiles.length === 0) || messageMutation.isPending}>Send message</button>
        </form>
      </CollapsibleSection>
    </div>
  );
};

export default StudentAdvisingPage;
