import {useState, type ReactNode} from 'react';
import {Check, Copy} from 'lucide-react';
import styles from './index.module.scss';

export function ChatMessage({user, text, pending, children}: {user: boolean; text: string; pending?: boolean; children: ReactNode}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const copy = async () => {
    try {await navigator.clipboard.writeText(text); setCopyState('copied');}
    catch {setCopyState('error');}
  };
  return <article className={styles.message} data-sender={user ? 'user' : 'assistant'}>
    <div className={styles.content}>{children}</div>
    {!user && !pending && text ? <div className={styles.actions}>
      <button type="button" onClick={() => void copy()} aria-label="Copy response">{copyState === 'copied' ? <Check size={16}/> : <Copy size={16}/>}<span>{copyState === 'copied' ? 'Copied' : 'Copy'}</span></button>
      <span role="status">{copyState === 'error' ? 'Copy failed. Select the response text to copy it.' : copyState === 'copied' ? 'Response copied.' : ''}</span>
    </div> : null}
  </article>;
}
