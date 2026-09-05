import { useTranslation } from 'react-i18next';
import {FormEvent, useEffect, useRef, useState} from 'react';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {
  aiAgentApiService,
  type AiAgentPendingAction,
  type AiAgentResponse,
  type AiAgentRole,
  type DeadlineDecision,
} from '@/apis/services/ai-agent-api';
import DeadlineDecisionModal from './DeadlineDecisionModal';
import {
  buildDetailsConfirmationMessage,
  isDetailsConfirmationReply,
  isGenericAssistantReset,
  lastOriginalUserRequest,
  toChatHistory,
  workflowErrorMessage,
  workflowMessageText,
  type WorkflowChatMessage,
} from './workflowConversation';
import DynamicThinking from '@/components/DynamicThinking/DynamicThinking';
import MarkdownMessage from '@/components/MarkdownMessage';
import {RichTextEditor} from '@/components/RichTextEditor';
import PanelExpandButton from './PanelExpandButton';
import styles from './index.module.scss';
import {isInstructorLevel} from '@/utils/roleCapabilities';

const READ_ONLY_QUICK_PROMPTS = [
  'assistant:workflow.prompts.due',
  'assistant:workflow.prompts.courses',
];

const INSTRUCTOR_QUICK_PROMPTS = [
  ...READ_ONLY_QUICK_PROMPTS,
  'assistant:workflow.prompts.deadline',
];

const WORKFLOW_THINKING_STEPS = [
  {id: 'understand', text: '', translationKey: 'assistant:workflow.steps.understand'},
  {id: 'context', text: '', translationKey: 'assistant:thinking.tools'},
  {id: 'response', text: '', translationKey: 'assistant:workflow.steps.response'},
];

const getAgentRole = (user: ReturnType<typeof useRequiredAuth>['user']): AiAgentRole =>
  // UI-only. The agent backend must derive authorization from the Bearer token.
  isInstructorLevel(user) ? 'INSTRUCTOR' : 'STUDENT';

interface WorkflowPanelProps {
  isExpanded?: boolean;
  isHidden?: boolean;
  onToggleExpand?: () => void;
}

const WorkflowPanel = ({
  isExpanded = false,
  isHidden = false,
  onToggleExpand,
}: WorkflowPanelProps) => {
  const { t: translate } = useTranslation();
  const {user} = useRequiredAuth();
  const role = getAgentRole(user);
  const canChangeDeadlines = role === 'INSTRUCTOR';
  const quickPrompts = canChangeDeadlines ? INSTRUCTOR_QUICK_PROMPTS : READ_ONLY_QUICK_PROMPTS;
  const nextMessageId = useRef(1);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<AiAgentPendingAction | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState('');
  const [awaitingDetailsConfirmation, setAwaitingDetailsConfirmation] = useState(false);
  const [detailsConfirmation, setDetailsConfirmation] = useState('');
  const [decisionError, setDecisionError] = useState<unknown>(null);
  const [messages, setMessages] = useState<WorkflowChatMessage[]>([
    {
      id: 0,
      sender: 'agent',
      text: '',
      translationKey: role === 'INSTRUCTOR'
        ? 'assistant:workflow.greeting.instructor'
        : 'assistant:workflow.greeting.student',
    },
  ]);

  const roleLabel = translate(role === 'INSTRUCTOR' ? 'assistant:workflow.role.instructor' : 'assistant:workflow.role.student');
  const blockingDecision = Boolean(pendingAction) || awaitingDetailsConfirmation;
  const showQuickPrompts = messages.length === 1 && !isSending;

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }, [isSending, messages, pendingAction, awaitingDetailsConfirmation]);

  const addMessage = (sender: WorkflowChatMessage['sender'], text: string, metadata?: Pick<WorkflowChatMessage, 'translationKey' | 'error' | 'isControl'>) => {
    setMessages(current => [
      ...current,
      {id: nextMessageId.current++, sender, text, ...metadata},
    ]);
  };

  const addReceipt = (translationKey: string) => addMessage('agent', '', {translationKey});

  const clearApprovalState = () => {
    setPendingAction(null);
    setPendingConfirmation('');
    setAwaitingDetailsConfirmation(false);
    setDetailsConfirmation('');
    setDecisionError(null);
  };

  const applyAgentResponse = (response: AiAgentResponse, options?: {afterDetailsConfirm?: boolean}) => {
    if (response.conversationId) {
      setConversationId(response.conversationId);
    }

    if (!response.pendingAction && !response.reply.trim()) {
      clearApprovalState();
      addReceipt('assistant:workflow.errors.empty');
      return;
    }

    if (response.pendingAction && !canChangeDeadlines) {
      clearApprovalState();
      addReceipt('assistant:workflow.errors.studentChange');
      return;
    }

    if (response.pendingAction) {
      if (!response.reply.trim()) {
        clearApprovalState();
        addReceipt('assistant:workflow.errors.incompleteApproval');
        return;
      }
      setPendingAction(response.pendingAction);
      setPendingConfirmation(response.reply);
      setAwaitingDetailsConfirmation(false);
      setDetailsConfirmation('');
      setDecisionError(null);
      return;
    }

    const needsDetailsConfirmation = canChangeDeadlines && (
      response.confirmationRequired || isDetailsConfirmationReply(response.reply)
    );

    if (needsDetailsConfirmation) {
      if (!response.reply.trim()) {
        clearApprovalState();
        addReceipt('assistant:workflow.errors.incompleteConfirmation');
        return;
      }
      setPendingAction(null);
      setPendingConfirmation('');
      addMessage('agent', response.reply);
      setAwaitingDetailsConfirmation(true);
      setDetailsConfirmation(response.reply);
      setDecisionError(null);
      return;
    }

    if (options?.afterDetailsConfirm && isGenericAssistantReset(response.reply)) {
      clearApprovalState();
      addReceipt('assistant:workflow.errors.reset');
      return;
    }

    clearApprovalState();
    addMessage('agent', response.reply);
  };

  const sendMessage = async (
    message: string,
    options?: {displayKey?: string; afterDetailsConfirm?: boolean},
  ) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending || pendingAction) return;
    if (awaitingDetailsConfirmation && !options?.afterDetailsConfirm) return;

    addMessage('user', options?.displayKey ? '' : trimmedMessage, options?.displayKey
      ? {translationKey: options.displayKey, isControl: true} : undefined);
    setInput('');
    setDecisionError(null);
    if (!options?.afterDetailsConfirm) {
      clearApprovalState();
    }
    setIsSending(true);

    try {
      const history = toChatHistory(messages);
      const response = await aiAgentApiService.chat({
        message: trimmedMessage,
        role,
        ...(conversationId ? {conversationId} : {}),
        ...(history.length ? {history} : {}),
      });
      applyAgentResponse(response, {afterDetailsConfirm: options?.afterDetailsConfirm});
    } catch (error) {
      addMessage('agent', '', {error, translationKey: 'assistant:errors.workflowUnavailable'});
      if (options?.afterDetailsConfirm) {
        setDecisionError(error);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleConfirmDetails = () => {
    if (!canChangeDeadlines || !awaitingDetailsConfirmation || isSending) return;
    void sendMessage(
      buildDetailsConfirmationMessage(lastOriginalUserRequest(messages)),
      {displayKey: 'common:actions.confirm', afterDetailsConfirm: true},
    );
  };

  const handleCancelDetails = () => {
    if (isSending) return;
    clearApprovalState();
    addMessage('user', '', {translationKey: 'common:actions.cancel', isControl: true});
    addReceipt('assistant:workflow.cancelled');
  };

  const handleDecision = async (decision: DeadlineDecision) => {
    if (!canChangeDeadlines || !pendingAction || isSending) return;
    setDecisionError(null);
    setIsSending(true);

    try {
      const response = await aiAgentApiService.decideDeadlineChange({
        actionId: pendingAction.actionId,
        decision,
      });
      if (response.reply) addMessage('agent', response.reply);
      else addReceipt(decision === 'ALLOW' ? 'assistant:workflow.approved' : 'assistant:workflow.rejected');
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }
      setPendingAction(response.pendingAction);
      setPendingConfirmation(response.pendingAction ? response.reply : '');
    } catch (error) {
      setDecisionError(error);
    } finally {
      setIsSending(false);
    }
  };

  const inputPlaceholder = pendingAction
    ? translate('assistant:workflow.placeholder.approval')
    : awaitingDetailsConfirmation
      ? translate('assistant:workflow.placeholder.confirmation')
      : translate('assistant:workflow.placeholder.request');

  return (
    <section
      className={`${styles.toolCard} ${isExpanded ? styles.expandedCard : ''}`}
      aria-labelledby="workflow-title"
      hidden={isHidden}
    >
      <div className={styles.toolHeader}>
        <div className={`${styles.toolIcon} ${styles.workflowIcon}`} aria-hidden="true">W</div>
        <div className={styles.toolHeading}>
          <h2 id="workflow-title">{translate("assistant:workspace.workflow")}</h2>
          <span className={`${styles.badge} ${styles.workflowBadge}`}>{translate("assistant:workflow.badge")}</span>
        </div>
        {onToggleExpand ? <PanelExpandButton
          panelName={translate('assistant:workspace.workflow')}
          isExpanded={isExpanded}
          onToggle={onToggleExpand}
        /> : null}
      </div>
      <p className={styles.toolDescription}>
        {translate("assistant:workflow.description")}</p>
      <div className={styles.divider}/>

      {showQuickPrompts ? (
        <div className={styles.quickPrompts} role="group" aria-label={translate("assistant:workflow.suggestions")}>
          <p>{translate("assistant:workflow.tryAsking")}</p>
          {quickPrompts.map(prompt => (
            <button
              type="button"
              key={prompt}
              onClick={() => void sendMessage(translate(prompt))}
              disabled={isSending || blockingDecision}
            >
              {translate(prompt)}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.workflowConversation} aria-live="polite" aria-busy={isSending}>
        <div className={styles.rolePill}>{roleLabel}</div>
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`${styles.message} ${message.sender === 'user' ? styles.userMessage : styles.agentMessage} ${index === messages.length - 1 ? styles.lastMessage : ''}`}
          >
            <MarkdownMessage content={workflowMessageText(message)}/>
          </div>
        ))}

        {isSending ? (
          <DynamicThinking
            label={translate("assistant:workflow.thinking")}
            fallbackSteps={WORKFLOW_THINKING_STEPS}
          />
        ) : null}
        <div ref={conversationEndRef}/>
      </div>

      <form className={styles.workflowInput} onSubmit={handleSubmit}>
        <RichTextEditor
          className={styles.workflowMarkdownEditor}
          variant="composer"
          showToolbar={false}
          content={input}
          onChange={setInput}
          onSubmit={() => void sendMessage(input)}
          placeholder={inputPlaceholder}
          disabled={isSending || blockingDecision}
          ariaLabel={translate("assistant:workflow.input")}
        />
        <div className={styles.inputFooter}>
          <span>{translate("assistant:keyboardHelp")}</span>
          <button type="submit" disabled={isSending || blockingDecision || !input.trim()}>
            {translate("assistant:workflow.run")}</button>
        </div>
      </form>

      {canChangeDeadlines && awaitingDetailsConfirmation && !pendingAction ? (
        <DeadlineDecisionModal
          title={translate("assistant:workflow.detailsTitle")}
          eyebrow={translate('assistant:workflow.reviewDetails')}
          confirmationText={detailsConfirmation}
          warningText={translate('assistant:workflow.detailsWarning')}
          confirmLabel={translate("common:actions.confirm")}
          cancelLabel={translate("common:actions.cancel")}
          errorMessage={decisionError ? workflowErrorMessage(decisionError) : null}
          isSubmitting={isSending}
          onDecision={decision => {
            if (decision === 'ALLOW') handleConfirmDetails();
            else handleCancelDetails();
          }}
        />
      ) : null}

      {canChangeDeadlines && pendingAction ? (
        <DeadlineDecisionModal
          confirmationText={pendingConfirmation}
          errorMessage={decisionError ? workflowErrorMessage(decisionError) : null}
          isSubmitting={isSending}
          onDecision={decision => void handleDecision(decision)}
        />
      ) : null}
    </section>
  );
};

export default WorkflowPanel;
