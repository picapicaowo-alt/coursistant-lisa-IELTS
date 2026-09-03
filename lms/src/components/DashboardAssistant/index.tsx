import {prompts, type Audience} from './prompts';
import {useId, useRef, useState} from 'react';
import styles from './index.module.scss';

/** API integration is supplied by the owning feature. An absent adapter never sends a simulated request. */
export function DashboardAssistant({audience, onPrompt, className}: {audience: Audience; onPrompt?: (prompt: string) => void; className?: string}) {
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const statusId = useId();
  const context = audience === 'instructor' ? 'teaching' : audience === 'advisor' ? 'advising' : 'learning';
  return <section className={[styles.chatPanel, className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
    <header className={styles.chatHeader}>
      <button type="button" aria-label="Chat history coming soon" disabled><img src="/icons/figma-dashboard/menu.svg" alt=""/></button>
      <h2 id={titleId}>New Chat</h2>
      <button type="button" aria-label="Start a new chat" onClick={() => {setDraft(''); input.current?.focus();}}><img src="/icons/figma-dashboard/add.svg" alt=""/></button>
    </header>
    <div className={styles.chatIntro}><p>Hi there!</p><strong>How can I help you with your {context} today?</strong></div>
    <div className={styles.quickPrompts}>{prompts[audience].map(prompt => <button type="button" key={prompt} onClick={() => {setDraft(prompt); input.current?.focus();}}>{prompt}</button>)}</div>
    <div className={styles.composerArea}>
      {!onPrompt ? <p className={styles.integrationStatus} id={statusId}>AI assistance is coming soon. You can prepare a question here.</p> : null}
      <form className={styles.chatComposer} onSubmit={event => {event.preventDefault(); if (draft.trim()) onPrompt?.(draft.trim());}}>
        <button type="button" aria-label={onPrompt ? 'Open chat to add an attachment' : 'Attachments coming soon'} disabled={!onPrompt} onClick={() => onPrompt?.('')} className={styles.composerAdd}>+</button>
        <input ref={input} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask me anything…" aria-label={`Ask the ${context} assistant`} aria-describedby={!onPrompt ? statusId : undefined}/>
        <button type="submit" aria-label="Send message" disabled={!onPrompt || !draft.trim()} className={styles.sendButton}><img src="/icons/figma-dashboard/send.svg" alt=""/></button>
      </form>
    </div>
  </section>;
}
