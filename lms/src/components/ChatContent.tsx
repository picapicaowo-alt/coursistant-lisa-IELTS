// @ts-nocheck — legacy chat bundle; quarantined until chat migration (PROJECT_STANDARDS.md §13).
import styles from '../sections/chat/chat-main-component/styles.module.scss';
import workspaceStyles from '../pages/aibot/StudySupportWorkspace.module.scss';
import {useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback} from 'react';
import {FileText, Paperclip, X, ArrowDown} from 'lucide-react';
import {prompts} from '@/components/DashboardAssistant/prompts';
import {Trans, useTranslation} from 'react-i18next';
import {ChatMessage} from '@/components/ChatMessage';
import TypingText from "../utils/typing-text";
import {renderMessageText} from '@/utils/render-message-text';
import {useAuth} from '@/contexts/AuthContext.js';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {useAiExamLockdown} from '@/hooks/useAiExamLockdown';
import {loadActiveChatCourses} from '@/utils/chatCourses';
import DynamicThinking from '@/components/DynamicThinking/DynamicThinking';
import {RichTextEditor} from '@/components/RichTextEditor';
import {readStudySupportAnswer} from '@/utils/studySupportResponse';
import {studySupportEndpoint} from '@/utils/studySupportEndpoint';
import {buildStudySupportFormData, buildStudySupportStreamBody} from '@/utils/studySupportRequest';
import {queryStudySupportWithFile, streamStudySupport} from '@/utils/studySupportStream';
import {safeStudySupportProgress} from '@/utils/studySupportProgress';
import {isInstructorLevel} from '@/utils/roleCapabilities';

const STUDY_SUPPORT_THINKING_STEPS = [
  {id: 'understand', text: '', translationKey: 'assistant:thinking.question'},
  {id: 'context', text: '', translationKey: 'assistant:thinking.courseContext'},
  {id: 'response', text: '', translationKey: 'assistant:thinking.response'},
];

interface Props {
  isIntroTop: boolean,
  courseId?: number,
  isWorkspace?: boolean,
  isCompact?: boolean,
  onClose?: () => void,
  isSummary?: false,
  isDashboard: boolean,
  isPopup?: false,
  setIsChatbotOpen?: (a: boolean) => void,
  showHistory?: false,
  setShowHistory?: (a: boolean) => void,
}

const ChatContent = forwardRef<HTMLDivElement, Props>(
  (
    props,
    ref
  ) => {
    const {t: translate} = useTranslation();
    const getBrowserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
    const handoffRef = useRef(false);
    if (!handoffRef.current) {
      handoffRef.current = !!sessionStorage.getItem('pendingChat');
    }
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {user} = useAuth();
    const chatAuthHeaders = () => ({
      Authorization: `Bearer ${user.accessToken}`,
      'X-Timezone': getBrowserTimeZone(),
    });
    const [courses, setCourses] = useState([]);
    const [isCourseOpen, setIsCourseOpen] = useState(false);
    const courseBoxRef = useRef(null);
    const handleSelectCourse = (id) => {
      setSelectedCourseId(Number(id));
      localStorage.setItem('selectedCourseId', String(id));
      setIsCourseOpen(false);
    };
    
    useEffect(() => {
      function onDown(e) {
        if (!courseBoxRef.current) return;
        if (!courseBoxRef.current.contains(e.target)) setIsCourseOpen(false);
      }
      
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }, []);
    const [isCoursesFetched, setIsCoursesFetched] = useState(false);
    const [courseFetchFailed, setCourseFetchFailed] = useState(false);
    const [selectedCourseId, setSelectedCourseId] = useState(() => {
      const v = props.courseId || searchParams.get('courseId') || localStorage.getItem('selectedCourseId');
      return v ? Number(v) : 0;
    });
    const fetchCourses = async () => {
      if (isCoursesFetched) return;
      setCourseFetchFailed(false);
      try {
        const list = await loadActiveChatCourses();
        setCourses(list);
        setIsCoursesFetched(true);
        
        const has = list.some(c => Number(c.id) === Number(selectedCourseId));
        if (!props.courseId && !has && list.length) {
          setSelectedCourseId(Number(list[0].id));
          localStorage.setItem('selectedCourseId', String(list[0].id));
        }
      } catch (e) {
        console.error('Failed to fetch courses:', e);
        setCourseFetchFailed(true);
      }
    };
    
    
    useEffect(() => {
      if (user?.accessToken && user?.id) {
        fetchCourses();
      }
    }, [user?.accessToken, user?.id]);
    const selectedCourse = courses.find(course => Number(course.id) === Number(selectedCourseId));
    const currentCourseName = selectedCourseId === 0 ? translate('dashboard:allCourses') : selectedCourse?.title || selectedCourse?.name || translate('assistant:courseFallback', {id: selectedCourseId});
    const relevantCourseIds = selectedCourseId === 0
      ? courses.map(course => Number(course.id))
      : [selectedCourseId];
    const requiresStudentExamLockdown = user ? !isInstructorLevel(user) : true;
    const examLockdown = useAiExamLockdown(
      relevantCourseIds,
      user?.id ?? null,
      Boolean(requiresStudentExamLockdown && isCoursesFetched && user?.accessToken && user?.id),
    );
    const isExamStatusPending = (!isCoursesFetched && !courseFetchFailed) || examLockdown.status === 'checking';
    const isStudySupportUnavailable = isExamStatusPending
      || courseFetchFailed
      || examLockdown.status === 'locked'
      || examLockdown.status === 'error';
    const lockedCourseNames = courses
      .filter(course => examLockdown.lockedCourseIds.includes(Number(course.id)))
      .map(course => course.title || course.name || translate('assistant:courseFallback', {id: course.id}))
      .join(', ');
    const examLockdownMessage = courseFetchFailed
      ? translate('assistant:courseListError')
      : isExamStatusPending
        ? translate('assistant:checkingAttempts')
        : examLockdown.status === 'error'
          ? translate('assistant:attemptCheckError')
          : selectedCourseId === 0
            ? translate('assistant:lockedCourses', {courses: lockedCourseNames || translate('assistant:oneOfCourses')})
            : translate('assistant:lockedCourse', {course: currentCourseName});
    const menuItemStyle = (active) => ({
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '8px 10px',
      fontSize: 14,
      background: active ? '#EEF2FF' : 'transparent',
      color: '#0f172a',
      border: 'none',
      cursor: 'pointer',
    });
    const bottomRef = useRef(null);
    const containerRef = useRef(null);
    const [isUserScrolled, setIsUserScrolled] = useState(false);
    const [isWriting, setIsWriting] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [thinkingSteps, setThinkingSteps] = useState([]);
    const thinkingStepId = useRef(0);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const compactInput = useRef<HTMLInputElement>(null);

    const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
      const container = containerRef.current;
      if (!container) return;
      container.scrollTo({top: container.scrollHeight, behavior});
    }, []);
    
    useEffect(() => {
      if (!isUserScrolled) scrollChatToBottom();
    }, [messages, scrollChatToBottom, isUserScrolled]);
    
    // Auto scroll to bottom when user is not scrolling
    useEffect(() => {
      if (messages.length === 0) return;
      if (!isWriting) return;
      if (isUserScrolled) return;
      
      const container = containerRef.current;
      if (!container) return;
      
      const checkScrollPosition = () => {
        const {scrollTop, scrollHeight, clientHeight} = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        if (isNearBottom) {
          scrollChatToBottom();
        }
      };
      
      const interval = setInterval(checkScrollPosition, 250); // Adjust as needed
      
      return () => clearInterval(interval);
    }, [isWriting, isUserScrolled, messages, scrollChatToBottom]);
    
    const handleNewChat = async () => {
      setMessages([]);
      setIsWriting(false);
      setInput('');
      setSelectedFile(null);
    };
    
    // expose the method to parent
    useImperativeHandle(ref, () => ({
      handleNewChat
    }));

    const handleSend = async (overrideText, overrideCourseId, overrideFile) => {
      const fileForSend = overrideFile ?? (overrideText == null ? selectedFile : null);
      const question = (overrideText ?? input)?.trim()
        || (fileForSend ? translate('assistant:reviewFile') : '');
      if (!question || isStudySupportUnavailable) return;
      
      const courseForSend = (typeof overrideCourseId === 'number')
        ? overrideCourseId
        : (selectedCourseId || 0);

      if (!Number.isInteger(courseForSend) || courseForSend <= 0) {
        setMessages(prev => [
          ...prev,
          {
            text: '', translationKey: 'assistant:selectCourseFirst',
            sender: 'chatbot',
          },
        ]);
        setIsWriting(false);
        return;
      }
      
      // build optimistic user bubble
      setIsWriting(false);
      if (overrideText == null) {
        setMessages(prev => [
          ...prev,
          {text: question, sender: 'user', attachmentName: fileForSend?.name ?? null}
        ]);
      }
      
      // clear input ONLY if we’re sending from the chat box
      if (overrideText == null) {
        setInput('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }

      setIsLoading(true);
      setThinkingSteps([]);

      try {
        const responseBody = fileForSend
          ? await queryStudySupportWithFile({
            url: studySupportEndpoint('/query'),
            body: buildStudySupportFormData({
              courseId: courseForSend,
              query: question,
              dialogueId: -1,
              file: fileForSend,
            }),
            headers: chatAuthHeaders(),
          })
          : await streamStudySupport({
            url: studySupportEndpoint('/query/stream'),
            body: buildStudySupportStreamBody({
              courseId: courseForSend,
              query: question,
              dialogueId: -1,
            }),
            headers: chatAuthHeaders(),
            onProgress: progress => {
              setThinkingSteps(current => {
                const nextStep = safeStudySupportProgress(
                  progress,
                  `${progress.phase}-${thinkingStepId.current++}`,
                );
                return current.at(-1)?.translationKey === nextStep.translationKey
                  ? current
                  : [...current, nextStep];
              });
            },
          });

        const answer = readStudySupportAnswer(responseBody);
        const newMessage = {
          text: answer,
          sender: 'chatbot',
        };
        setIsLoading(false);
        setThinkingSteps([]);
        setMessages(prev => [...prev, newMessage]);
        setIsWriting(true);
      } catch {
        console.error('Study Support request failed.');
        setIsLoading(false);
        setThinkingSteps([]);
        setIsWriting(false);
        setMessages(prev => [
          ...prev,
          {
            text: '', translationKey: 'assistant:responseError',
            sender: 'chatbot',
          }
        ]);
      }
    };
    
    const handleSendClick = () => {
      if ((!input.trim() && !selectedFile) || isStudySupportUnavailable) return;
      
      if (props.isDashboard) {
        const payload = {text: input.trim(), courseId: selectedCourseId ?? 0};
        sessionStorage.setItem('pendingChat', JSON.stringify(payload));
        sessionStorage.removeItem('hydrateThenSend');
        localStorage.setItem('selectedCourseId', String(payload.courseId));
        navigate('/aibot');
        return;
      }
      
      handleSend();
    };

    useEffect(() => {
      if (props.isDashboard) return;
      
      const raw = sessionStorage.getItem('pendingChat');
      if (!raw) return;
      if (isExamStatusPending) return;
      
      sessionStorage.removeItem('pendingChat');
      
      (async () => {
        try {
          const {text, courseId} = JSON.parse(raw) || {};
          if (typeof courseId !== 'undefined') {
            setSelectedCourseId(Number(courseId));
            localStorage.setItem('selectedCourseId', String(courseId));
          }
          if (examLockdown.status !== 'unlocked') {
            if (text && text.trim()) setInput(text.trim());
            return;
          }
          if (text && text.trim()) {
            setMessages(prev => [
              ...prev,
              {text: text.trim(), sender: 'user'}
            ]);
            await handleSend(text.trim(), typeof courseId === 'number' ? courseId : undefined);
          }
        } catch (e) {
          console.error('Failed to parse pendingChat payload', e);
          
        } finally {
          sessionStorage.removeItem('hydrateThenSend');
          handoffRef.current = false;
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.isDashboard, isExamStatusPending, examLockdown.status]);
    
    return (
      <>
        {(props.isDashboard || props.isPopup) && (
          <>
            <div className={styles.chatHeader}>
              <div className={styles.chatTitle}>
                <h1 className="text-[1.5rem] font-medium">{translate('assistant:newChat')}</h1>
              </div>
              <div className={styles.spacer}/>
              <button className={styles.glassButton} onClick={() => {
                handleNewChat()
              }}>
                <img className="w-[1.3rem]" src="/icons/chat/add_plus.png" alt=""/>
                <span className="text-[1rem]">{translate('assistant:new')}</span>
              </button>
              {props.isPopup && (
                <button
                  className={styles.glassButton}
                  onClick={() => {
                    props.setIsChatbotOpen(false);
                  }}
                >
                  <img className="w-[1.3rem]" src="/icons/add-content/close-circle.png" alt={translate('common:actions.close')}/>
                </button>
              )}
            </div>
            <div className={styles.horizontalLine}/>
          </>
        )}
        {/*  Main Content */}
        <div data-compact={props.isCompact || undefined} data-empty={!props.isCompact && props.isWorkspace && messages.length === 0 && !isStudySupportUnavailable || undefined} className={props.isWorkspace ? workspaceStyles.content : `flex flex-col p-2 ${props.isDashboard ? 'h-[90%]' : props.isSummary ? 'h-[87%]' : 'h-[95%]'}`}>
          {props.isCompact ? <header className={workspaceStyles.compactHeader}><h2>{translate('assistant:newChat')}</h2><button type="button" aria-label={translate('assistant:startNew')} onClick={handleNewChat}>+</button><button type="button" aria-label={translate('assistant:closeCourse')} onClick={props.onClose}><X size={18}/></button></header> : props.isWorkspace ? <div className={workspaceStyles.toolbar}><button type="button" onClick={handleNewChat}>{translate('assistant:createChat')}</button></div> : null}
          <div className={props.isWorkspace ? workspaceStyles.messageArea : "flex flex-1 flex-col gap-3 overflow-y-auto p-4"} ref={containerRef} onScroll={event => {const element = event.currentTarget; setIsUserScrolled(element.scrollHeight - element.scrollTop - element.clientHeight > 100);}}>
            {isStudySupportUnavailable ? (
              <div
                id="study-support-lockdown-message"
                className="m-auto max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-5 text-left text-amber-950"
                role={courseFetchFailed || examLockdown.status === 'error' ? 'alert' : 'status'}
              >
                <strong>{examLockdown.status === 'locked' ? translate('assistant:lockdownActive') : translate('assistant:supportUnavailable')}</strong>
                <p className="mt-2 text-sm">{examLockdownMessage}</p>
                {courseFetchFailed ? (
                  <button
                    type="button"
                    className="mt-3 rounded-lg border border-amber-500 bg-white px-3 py-2 text-sm font-semibold"
                    onClick={() => void fetchCourses()}
                  >{translate('common:actions.tryAgain')}</button>
                ) : null}
              </div>
            ) : messages.length === 0 ? (
              props.isCompact ? <div className={workspaceStyles.compactPrompts}>{prompts.student.map(key => <button type="button" key={key} onClick={() => {setInput(translate(key)); compactInput.current?.focus();}}>{translate(key)}</button>)}</div> : props.isSummary ? (
                <div className="flex-1 flex flex-col justify-start mb-8 ml-3">
                  <div
                    className="cursor-pointer hover:bg-[#EDF2F7] transition-all duration-300 flex items-center p-4 border border-[rgba(226,232,240,1)] rounded-xl  bg-transparent max-w-xl">
                    <div className="flex-1">
                      <h3 className="text-lg text-gray-900 mb-1">{translate('assistant:summarize')}</h3>
                      <p className="text-sm text-[rgba(160,174,192,1)]">{translate('assistant:summarizeHelp')}</p>
                    </div>
                    <div className="ml-3 mt-1">
                      <img src="/icons/roster/suggestion.png" alt=""/>
                    </div>
                  </div>
                </div>
              ) : props.isWorkspace ? <div className={workspaceStyles.welcome}><img src="/icons/figma-ai/chat-mark.svg" alt=""/><h2><Trans i18nKey="assistant:personalHeading" components={[<span key="emphasis"/>]}/></h2></div> : (
                <div
                  className={`flex-1 flex flex-col items-start text-left mb-8 ml-3 ${props.isIntroTop ? 'justify-start' : 'justify-end'
                  }`}
                >
                  <h1 className="text-2xl font-bold">{translate('assistant:welcomeBack', {name: user?.name ?? ''})}</h1>
                  <p className="text-sm text-gray-500 mt-2">{translate('assistant:encouragement')}</p>
                </div>
              )
            ) : (
              // {/* Chat messages area (scrollable) */}
              <>
                {messages.map((msg, index) => (
                  <ChatMessage key={index} user={msg.sender === 'user'} text={msg.translationKey ? translate(msg.translationKey) : msg.text} pending={isWriting && index === messages.length - 1 && msg.sender !== 'user'}>
                    {msg.attachmentName ? (
                      <span className={styles.messageAttachment}>
                        <FileText aria-hidden="true"/>
                        {msg.attachmentName}
                      </span>
                    ) : null}
                    {/* text / typing animation */}
                    {isWriting && index === messages.length - 1 && msg.sender !== 'user' ? (
                      <TypingText text={msg.text} speed={5} onDone={() => setIsWriting(false)}/>
                    ) : (
                      <div className="whitespace-pre-line text-base text-gray-900">
                        {renderMessageText(msg.translationKey ? translate(msg.translationKey) : msg.text)}
                      </div>
                    )}
                  </ChatMessage>
                ))}
                
                {isLoading ? (
                  <DynamicThinking
                    steps={thinkingSteps}
                    fallbackSteps={STUDY_SUPPORT_THINKING_STEPS}
                  />
                ) : null}
                <div ref={bottomRef}/>
              </>
            )}
          </div>
          {isUserScrolled && messages.length > 0 ? <button type="button" className={styles.latestMessage} onClick={() => scrollChatToBottom()}><ArrowDown size={16}/>{translate('assistant:latestResponse')}</button> : null}
          {/* Input area */}
          {props.isCompact ? <div className={workspaceStyles.compactComposer}>
            {selectedFile ? <div className={workspaceStyles.compactAttachment}><FileText size={16}/><span>{selectedFile.name}</span><button type="button" aria-label={translate('common:actions.removeItem', {item: selectedFile.name})} onClick={() => setSelectedFile(null)}><X size={16}/></button></div> : null}
            <input ref={fileInputRef} type="file" className={styles.visuallyHidden} accept=".pdf,.doc,.docx,.txt,.md,image/*" aria-label={translate('assistant:chooseFile')} onChange={event => setSelectedFile(event.target.files?.[0] ?? null)}/>
            <button type="button" className={workspaceStyles.compactAttach} aria-label={translate('assistant:attachFile')} disabled={isStudySupportUnavailable || isLoading} onClick={() => fileInputRef.current?.click()}>+</button>
            <input ref={compactInput} aria-label={translate('assistant:askSupport')} placeholder={translate('assistant:ask')} value={input} onChange={event => setInput(event.target.value)} disabled={isStudySupportUnavailable || isLoading} onKeyDown={event => {if (event.key === 'Enter' && !event.nativeEvent.isComposing) {event.preventDefault(); handleSendClick();}}}/>
            <button type="button" className={workspaceStyles.compactSend} aria-label={translate('common:actions.send')} disabled={isStudySupportUnavailable || isLoading || (!input.trim() && !selectedFile)} onClick={handleSendClick}><img src="/icons/figma-dashboard/send.svg" alt=""/></button>
          </div> : <div className={styles.chatInputContainer}>
            <div ref={courseBoxRef} style={{position: 'relative', display: 'inline-block'}}>
              <button
                type="button"
                className={styles.chatCourse}
                onClick={() => isCoursesFetched && setIsCourseOpen(v => !v)}
                aria-haspopup="listbox"
                aria-expanded={isCourseOpen}
                title={currentCourseName}
                disabled={!isCoursesFetched || Boolean(props.courseId)}
                style={{width: 150}}
              >
                <img className={styles.chatCourseIcon} src="/icons/ai_course.png" alt=""/>
                <p style={{
                  maxWidth: 110,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}>
                  {isCoursesFetched ? currentCourseName : translate('common:feedback.loading')}
                </p>
              </button>
              
              {isCourseOpen && (
                <div
                  role="listbox"
                  tabIndex={-1}
                  style={{
                    position: 'absolute',
                    zIndex: 1000,
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 240,
                    maxHeight: 260,
                    overflowY: 'auto',
                    background: '#fff',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
                  }}
                >
                  {courses.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => handleSelectCourse(c.id)}
                      style={menuItemStyle(Number(selectedCourseId) === Number(c.id))}
                      title={c.title || c.name}
                    >
                      {c.title || c.name || translate('assistant:courseFallback', {id: c.id})}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            
            <div className={styles.chatInputMessage}>
              <RichTextEditor
                className={styles.chatMarkdownEditor}
                variant="composer"
                showToolbar={false}
                content={input}
                onChange={setInput}
                onSubmit={handleSendClick}
                placeholder={translate('assistant:askMaterials')}
                disabled={isStudySupportUnavailable}
                ariaLabel={translate('assistant:askSupport')}
              />
            </div>

            {selectedFile ? (
              <div className={styles.selectedFile} aria-label={translate('assistant:attachedFile', {name: selectedFile.name})}>
                <FileText aria-hidden="true"/>
                <span title={selectedFile.name}>{selectedFile.name}</span>
                <button
                  type="button"
                  aria-label={translate('common:actions.removeItem', {item: selectedFile.name})}
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X aria-hidden="true"/>
                </button>
              </div>
            ) : null}
            
            {/* footer */}
            <div className={styles.chatFooter}>
              {!props.isDashboard ? (
                <>
                  <input
                    ref={fileInputRef}
                    className={styles.visuallyHidden}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md,image/*"
                    aria-label={translate('assistant:chooseFile')}
                    onChange={event => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className={styles.chatFooterIconButton}
                    aria-label={translate('assistant:attachFile')}
                    title={translate('assistant:attachFile')}
                    disabled={isStudySupportUnavailable || isLoading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className={styles.chatFooterIcon} aria-hidden="true"/>
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-500">{translate('assistant:keyboardHelp')}</span>
              )}
              <div className={styles.spacer}/>
              <button
                type="button"
                className={styles.chatFooterSend}
                onClick={handleSendClick}
                disabled={isStudySupportUnavailable || isLoading || (!input.trim() && !selectedFile)}
              >{translate('common:actions.send')}<img src="/icons/chat/send-star.png" alt=""/>
              </button>
            </div>
          </div>}
        </div>
      </>
    );
  });

export default ChatContent;
