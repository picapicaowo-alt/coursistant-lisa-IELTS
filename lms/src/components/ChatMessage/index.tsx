import { useTranslation } from 'react-i18next';
import {useState, type ReactNode} from 'react';
import {Check, Copy} from 'lucide-react';
import styles from './index.module.scss';

export function ChatMessage({user, text, pending, children}: {user: boolean; text: string; pending?: boolean; children: ReactNode}) {
  const { t: translate } = useTranslation();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const copy = async () => {
    try {await navigator.clipboard.writeText(text); setCopyState('copied');}
    catch {setCopyState('error');}
  };
  return <article className={styles.message} data-sender={user ? 'user' : 'assistant'}>
    <div className={styles.content}>{children}</div>
    {!user && !pending && text ? <div className={styles.actions}>
      <button type="button" onClick={() => void copy()} aria-label={translate("assistant:copy.label")}>{copyState === 'copied' ? <Check size={16}/> : <Copy size={16}/>}<span>{copyState === 'copied' ? translate("assistant:copy.copied") : translate("assistant:copy.copy")}</span></button>
      <span role="status">{copyState === 'error' ? translate("assistant:copy.failed") : copyState === 'copied' ? translate('assistant:copy.success') : ''}</span>
    </div> : null}
  </article>;
}
