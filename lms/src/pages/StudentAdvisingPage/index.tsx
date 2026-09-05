import {useTranslation} from 'react-i18next';
import {ADVISING_ERROR_CODES} from '@/apis';
import {WorkspaceSection as CollapsibleSection} from '@/components/WorkspaceSection';
import {PlanOverview} from './PlanOverview';
import React, {lazy, Suspense, useState} from 'react';
import {STUDENT_PLAN_VIEWS} from '@/configs/routePaths';
import pageStyles from './index.module.scss';
const MyOperationsPage = lazy(() => import('../MyOperationsPage'));
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
import {getApiErrorMessage, isMissingResource} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import {advisorConversationPage} from '../AdvisorOperationsPage/advisorViewModels';
import styles from '../advising/advising.module.scss';

const StudentAdvisingPage: React.FC = () => {
  const {t} = useTranslation('advising');
  const queryClient = useQueryClient();
  const [fileIssue, setFileIssue] = useState<{kind: 'popupBlocked'} | {kind: 'loadError'; error: unknown} | null>(null);
  const [filePending, setFilePending] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view');
  const showLearning = view === STUDENT_PLAN_VIEWS.learning;
  const showMessages = view === STUDENT_PLAN_VIEWS.messages;
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
    enabled: showMessages,
    queryFn: async ({pageParam}) => advisorConversationPage(unwrapData(await advisorApiService.listOwnConversationMessages(pageParam), 'studentAdvisorConversation')),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage, _pages, lastCursor) => lastPage.hasMore && lastPage.nextBeforeId != null && (lastCursor == null || lastPage.nextBeforeId < lastCursor) ? lastPage.nextBeforeId : undefined,
    retry: false,
  });
  const taskMutation = useMutation({
    mutationFn: ({action, taskId, version}: TaskAction) =>
      action === 'start'
        ? idempotency.run('student-start-task', [taskId, {expectedVersion: version}] satisfies Parameters<typeof advisorApiService.startOwnAdvisorTask>, (key, args) => advisorApiService.startOwnAdvisorTask(...args, key))
        : idempotency.run('student-complete-task', [taskId, {expectedVersion: version, submissionText: taskSubmissions[taskId] ?? plan.data?.plan?.checkpoints?.flatMap(checkpoint => checkpoint.tasks ?? []).find(task => task.id === taskId)?.submissionText}] satisfies Parameters<typeof advisorApiService.completeOwnAdvisorTask>, (key, args) => advisorApiService.completeOwnAdvisorTask(...args, key)),
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
    if (filePending) return;
    setFileIssue(null);
    const popup = openPreviewWindow();
    if (!popup) {setFileIssue({kind: 'popupBlocked'}); return;}
    setFilePending(true);
    try {
      const blob = await advisorApiService.previewOwnConversationAttachment(attachmentId);
      showBlobInPreviewWindow(popup, blob);
    } catch (error) {
      popup.close();
      setFileIssue({kind: 'loadError', error});
    } finally {
      setFilePending(false);
    }
  };
  const downloadAttachment = async (attachmentId: number, name?: string): Promise<void> => {
    if (filePending) return;
    setFileIssue(null);
    setFilePending(true);
    try {
      saveBlob(await advisorApiService.downloadOwnConversationAttachment(attachmentId), name || `advisor-attachment-${attachmentId}`);
    } catch (error) {
      setFileIssue({kind: 'loadError', error});
    } finally {
      setFilePending(false);
    }
  };
  const conversationRows = conversation.data?.pages.flatMap(page => page.items) ?? [];
  const checkpointKey = searchParams.get(STUDY_PLAN_PARAMS.checkpoint);
  const checkpointIndex = plan.data?.plan?.checkpoints?.findIndex((checkpoint, index) => studyPlanRecordKey(checkpoint, index) === checkpointKey) ?? -1;
  const checkpoint = checkpointIndex >= 0 ? plan.data?.plan?.checkpoints?.[checkpointIndex] : undefined;
  const backToPlan = () => {
    const next = new URLSearchParams(searchParams);
    next.delete(STUDY_PLAN_PARAMS.checkpoint);
    next.delete(STUDY_PLAN_PARAMS.task);
    setSearchParams(next);
    if (!taskMutation.isPending) taskMutation.reset();
  };
  const openCheckpoint = (key: string, taskId?: number) => {
    const next = new URLSearchParams(searchParams);
    next.set(STUDY_PLAN_PARAMS.checkpoint, key);
    if (taskId != null) next.set(STUDY_PLAN_PARAMS.task, String(taskId));
    else next.delete(STUDY_PLAN_PARAMS.task);
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
      <nav className={pageStyles.tabs} aria-label="Study plan views">
        {[[STUDENT_PLAN_VIEWS.overview, 'Overview'], ['tasks', 'Advisor Tasks'], [STUDENT_PLAN_VIEWS.learning, 'Learning overview'], [STUDENT_PLAN_VIEWS.messages, 'Advisor messages']].map(([key, label]) => <button type="button" key={key} aria-pressed={key === (view || STUDENT_PLAN_VIEWS.overview)} onClick={() => { const next = new URLSearchParams(searchParams); next.set('view', key); setSearchParams(next); }}>{label}</button>)}
      </nav>
      {showLearning ? <Suspense fallback={<p role="status">Loading learning overview…</p>}><MyOperationsPage embedded/></Suspense> : null}
      {!showLearning && !showMessages ? <>
      {profile.isPending || plan.isPending ? <p role="status">Loading your learning plan…</p> : null}
      {profile.isError && !isMissingResource(profile.error, ADVISING_ERROR_CODES.profileNotFound) ? <p className={styles.error} role="alert">{advisingErrorMessage(profile.error, 'Profile could not be loaded.')} <button type="button" onClick={() => void profile.refetch()}>Retry profile</button></p> : null}
      {plan.isError && !isMissingResource(plan.error, ADVISING_ERROR_CODES.studyPlanNotFound) ? <p className={styles.error} role="alert">{advisingErrorMessage(plan.error, 'Study plan could not be loaded.')} <button type="button" onClick={() => void plan.refetch()}>Retry plan</button></p> : null}
      {!profile.isPending && !plan.isPending && (!profile.isError || isMissingResource(profile.error, ADVISING_ERROR_CODES.profileNotFound)) && (!plan.isError || isMissingResource(plan.error, ADVISING_ERROR_CODES.studyPlanNotFound)) ? <PlanOverview profile={profile.data} plan={plan.data?.plan} onCheckpoint={openCheckpoint}/> : null}
      {taskMutation.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(taskMutation.error, 'The task could not be updated.')}</p> : null}
      </> : null}
      {showMessages ? <CollapsibleSection title="Advisor conversation" className={styles.disclosureLayout} summary="Ask questions, share context, or attach supporting files." meta={<span className={styles.countBadge}>{conversationRows.length}</span>}>

        {fileIssue ? <p className={styles.error} role="alert">{fileIssue.kind === 'popupBlocked' ? t('attachments.popupBlocked') : getApiErrorMessage(fileIssue.error, t('attachments.loadError'))}</p> : null}
        {markReadMutation.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(markReadMutation.error, t('conversation.markReadError'))}</p> : null}
        {messageMutation.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(messageMutation.error, 'Message could not be sent.')}</p> : null}
        {conversation.isPending ? <p className={styles.status}>Loading messages…</p> : null}
        {conversation.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(conversation.error, t('conversation.loadError'))} <button type="button" onClick={() => void conversation.refetch()}>{t('conversation.retry')}</button></p> : null}
        {conversation.isSuccess && conversationRows.length === 0 ? <div className={styles.emptyState}><strong>{t('conversation.empty')}</strong><span>{t('conversation.emptyHelp')}</span></div> : null}
        <div className={styles.messageList}>{conversationRows.map((item, index) => <article className={styles.messageRow} key={item.messageId ?? index}>
          <div className={styles.rowTitle}><strong>{item.senderUserId == null ? 'Conversation message' : `User #${item.senderUserId}`}</strong><small>{item.createdAt || ''}</small></div>
          <p>{item.body || 'Message has no text content.'}</p>
          {(item.attachments?.length ?? 0) > 0 ? <div className={styles.attachmentList}>{item.attachments?.map(attachment => attachment.attachmentId == null ? null : <div className={styles.attachmentRow} key={attachment.attachmentId}>
            <span>{attachment.originalName || `Attachment #${attachment.attachmentId}`}</span>
            <div className={styles.actions}>{attachment.previewAvailable ? <button type="button" className={styles.secondary} disabled={filePending} onClick={() => void previewAttachment(attachment.attachmentId!)}>{t('attachments.preview')}</button> : null}<button type="button" className={styles.secondary} disabled={filePending} onClick={() => void downloadAttachment(attachment.attachmentId!, attachment.originalName)}>{t('attachments.download')}</button></div>
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
      </CollapsibleSection> : null}
    </div>
  );
};

export default StudentAdvisingPage;
