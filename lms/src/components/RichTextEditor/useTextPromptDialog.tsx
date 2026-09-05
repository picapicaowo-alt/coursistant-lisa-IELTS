import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Editor} from '@tiptap/core';
import {TeachingDialog} from '@/components/TeachingWorkspace';
import styles from '@/components/TeachingWorkspace/index.module.scss';
import {normalizeSafeUrl} from './url';

interface TextPrompt {
  titleKey: string;
  initialValue: string;
  validate?: (value: string) => string | undefined;
}

export function useTextPromptDialog() {
  const {t} = useTranslation();
  const [request, setRequest] = useState<TextPrompt | null>(null);
  const [value, setValue] = useState('');
  const [errorKey, setErrorKey] = useState<string>();
  const resolveRef = useRef<((value: string | null) => void) | null>(null);
  const prompt = useCallback((next: TextPrompt) => {
    resolveRef.current?.(null);
    setRequest(next);
    setValue(next.initialValue);
    setErrorKey(undefined);
    return new Promise<string | null>(resolve => { resolveRef.current = resolve; });
  }, []);
  const close = (result: string | null) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setRequest(null);
  };
  useEffect(() => () => { resolveRef.current?.(null); }, []);
  const submit = () => {
    const error = request?.validate?.(value);
    setErrorKey(error);
    if (!error) close(value);
  };

  // Keep keys and the draft as state so changing the product locale neither
  // reopens the dialog nor edits the authored document. Avoid nested forms.
  const dialog = request ? (
    <TeachingDialog title={t(request.titleKey)} onClose={() => close(null)}>
      <div className={styles.form}>
        <label>{t(request.titleKey)}
          <input value={value} autoFocus aria-invalid={Boolean(errorKey)}
            onChange={event => { setValue(event.target.value); setErrorKey(undefined); }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.stopPropagation();
                submit();
              }
            }}/>
        </label>
        {errorKey ? <p className={styles.error} role="alert">{t(errorKey)}</p> : null}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => close(null)}>{t('common:actions.cancel')}</button>
          <button type="button" className={styles.primary} onClick={submit}>{t('common:actions.save')}</button>
        </div>
      </div>
    </TeachingDialog>
  ) : null;
  return {prompt, dialog};
}

export async function editLink(editor: Editor, prompt: ReturnType<typeof useTextPromptDialog>['prompt']) {
  const document = editor.state.doc;
  const selection = editor.state.selection;
  const value = await prompt({
    titleKey: 'editor:linkUrl',
    initialValue: String(editor.getAttributes('link').href ?? ''),
    validate: value => value.trim() && !normalizeSafeUrl(value, {allowRelative: true}) ? 'editor:invalidLink' : undefined,
  });
  // An external document update may arrive while the modal owns focus.
  if (value === null || editor.isDestroyed || !editor.isEditable || !editor.state.doc.eq(document)) return;
  const chain = editor.chain().focus().setTextSelection({from: selection.from, to: selection.to}).extendMarkRange('link');
  const url = normalizeSafeUrl(value, {allowRelative: true});
  if (url) chain.setLink({href: url}).run();
  else chain.unsetLink().run();
}
