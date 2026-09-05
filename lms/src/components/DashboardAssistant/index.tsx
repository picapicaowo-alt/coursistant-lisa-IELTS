import { useTranslation } from 'react-i18next';
import {prompts, type Audience} from './prompts';
import {useId, useRef, useState} from 'react';
import styles from './index.module.scss';
import {Lightbulb, NotebookPen, Mic, GraduationCap} from 'lucide-react';

const studentPromptIcons = [Lightbulb, NotebookPen, Mic, GraduationCap];

/** API integration is supplied by the owning feature. An absent adapter never sends a simulated request. */
export function DashboardAssistant({audience, onPrompt, className}: {audience: Audience; onPrompt?: (prompt: string) => void; className?: string}) {
  const { t: translate } = useTranslation();
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  if (!onPrompt) return null;
  return <section className={[styles.chatPanel, className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
    <header className={styles.chatHeader}>
      <h2 id={titleId}>{translate("assistant:newChat")}</h2>
      <button type="button" aria-label={translate("assistant:startNew")} onClick={() => {setDraft(''); input.current?.focus();}}><img src="/icons/figma-dashboard/add.svg" alt=""/></button>
    </header>
    <div className={styles.chatIntro}><p>{translate("assistant:greeting")}</p><strong>{translate(`assistant:help.${audience}`)}</strong></div>
    <div className={styles.quickPrompts}>{prompts[audience].map((key, index) => {const prompt = translate(key); const Icon = audience === 'student' ? studentPromptIcons[index] : undefined; return <button type="button" key={key} onClick={() => {setDraft(prompt); input.current?.focus();}}>{Icon ? <Icon size={20} aria-hidden="true"/> : null}<span>{prompt}</span></button>;})}</div>
    <div className={styles.composerArea}>
      <form className={styles.chatComposer} onSubmit={event => {event.preventDefault(); if (draft.trim()) onPrompt?.(draft.trim());}}>
        <button type="button" aria-label={translate("assistant:attachmentOpen")} onClick={() => onPrompt('')} className={styles.composerAdd}>+</button>
        <input ref={input} value={draft} onChange={event => setDraft(event.target.value)} placeholder={translate("assistant:ask")} aria-label={translate(`assistant:input.${audience}`)}/>
        <button type="submit" aria-label={translate("assistant:send")} disabled={!onPrompt || !draft.trim()} className={styles.sendButton}><img src="/icons/figma-dashboard/send.svg" alt=""/></button>
      </form>
    </div>
  </section>;
}
