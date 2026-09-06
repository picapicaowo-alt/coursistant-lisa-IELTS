import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {act, cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import i18n, {LOCALE_STORAGE_KEY} from '../i18n';
import LanguageSwitcher from './LanguageSwitcher';

function FormWithLocale() {
  const {t} = useTranslation('common');
  const [draft, setDraft] = useState('');
  return <><LanguageSwitcher/><input aria-label="draft" value={draft} onChange={event => setDraft(event.target.value)}/><button>{t('actions.save')}</button></>;
}

describe('shared language selection', () => {
  beforeEach(async () => {await i18n.changeLanguage('en');});
  afterEach(async () => {cleanup(); await i18n.changeLanguage('en'); localStorage.clear();});

  it('updates labels without a reload or resetting an unfinished form', async () => {
    const user = userEvent.setup();
    render(<FormWithLocale/>);
    await user.type(screen.getByRole('textbox'), 'Keep my draft');
    await user.selectOptions(screen.getByRole('combobox', {name: 'Language'}), 'zh-CN');
    expect(screen.getByRole('button', {name: '保存'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Keep my draft');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-CN');
    await user.selectOptions(screen.getByRole('combobox', {name: '语言'}), 'zh-TW');
    expect(screen.getByRole('combobox', {name: '語言'})).toHaveValue('zh-TW');
    expect(document.documentElement.lang).toBe('zh-TW');
    expect(screen.getByRole('textbox')).toHaveValue('Keep my draft');
  });

  it('keeps the saved locale when the picker is remounted on another route', async () => {
    await act(async () => {await i18n.changeLanguage('zh-TW');});
    const first = render(<LanguageSwitcher/>);
    first.unmount();
    render(<LanguageSwitcher/>);
    expect(screen.getByRole('combobox', {name: '語言'})).toHaveValue('zh-TW');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-TW');
  });
});
