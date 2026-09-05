import {useTranslation} from 'react-i18next';
import {prompts, type Audience} from './prompts';
import {useId, useRef, useState} from 'react';
import styles from './index.module.scss';
import {Lightbulb, NotebookPen, Mic, GraduationCap} from 'lucide-react';

const studentPromptIcons = [Lightbulb, NotebookPen, Mic, GraduationCap];

/** API integration is supplied by the owning feature. An absent adapter never sends a simulated request. */
export function DashboardAssistant({audience, onPrompt, className}: {audience: Audience; onPrompt?: (prompt: string) => void; className?: string}) {
  const {t} = useTranslation('dashboard');
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  if (!onPrompt) return null;
  const context = audience === 'instructor' ? 'teaching' : audience === 'advisor' ? 'advising' : 'learning';
  return <section className={[styles.chatPanel, className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
    <header className={styles.chatHeader}>
      <h2 id={titleId}>New Chat</h2>
      <button type="button" aria-label="Start a new chat" onClick={() => {setDraft(''); input.current?.focus();}}><img src="/icons/figma-dashboard/add.svg" alt=""/></button>
    </header>
    <div className={styles.chatIntro}><p>Hi there!</p><strong>How can I help you with your {context} today?</strong></div>
    <div className={styles.quickPrompts}>{prompts[audience].map((prompt, index) => {const Icon = audience === 'student' ? studentPromptIcons[index] : undefined; return <button type="button" key={prompt} onClick={() => {setDraft(prompt); input.current?.focus();}}>{Icon ? <Icon size={20} aria-hidden="true"/> : null}<span>{prompt}</span></button>;})}</div>
    <div className={styles.composerArea}>
      <form className={styles.chatComposer} onSubmit={event => {event.preventDefault(); if (draft.trim()) onPrompt?.(draft.trim());}}>
        <button type="button" aria-label={t('assistantAttachment')} disabled={!onPrompt} onClick={() => onPrompt?.('')} className={styles.composerAdd}>+</button>
        <input ref={input} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask me anything…" aria-label={`Ask the ${context} assistant`}/>
        <button type="submit" aria-label="Send message" disabled={!onPrompt || !draft.trim()} className={styles.sendButton}><img src="/icons/figma-dashboard/send.svg" alt=""/></button>
      </form>
    </div>
  </section>;
}
