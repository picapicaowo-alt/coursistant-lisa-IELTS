import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Editor} from '@tiptap/core';
import i18n from '@/i18n';
import {SUPPORTED_LOCALES} from '@/i18n/configuration';
import {createEditorExtensions} from './extensions';
import {editLink, useTextPromptDialog} from './useTextPromptDialog';
import {RichTextEditor} from './index';

beforeEach(() => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {this.setAttribute('open', '');});
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {this.removeAttribute('open');});
});
afterEach(async () => {cleanup(); vi.restoreAllMocks(); await i18n.changeLanguage('en');});

function Harness({complete}: {complete: (value: string | null) => void}) {
  const {prompt, dialog} = useTextPromptDialog();
  return <><button onClick={() => void prompt({titleKey: 'editor:linkUrl', initialValue: '', validate: value => value === 'invalid' ? 'editor:invalidLink' : undefined}).then(complete)}>Open</button>{dialog}</>;
}

describe('product-localized editor dialogs', () => {
  it('preserves a rejected link draft and dialog identity in all three locales', async () => {
    const complete = vi.fn();
    render(<Harness complete={complete}/>);
    fireEvent.click(screen.getByRole('button', {name: 'Open'}));
    const input = screen.getByRole('textbox');
    const dialog = screen.getByRole('dialog');
    fireEvent.change(input, {target: {value: 'invalid'}});
    fireEvent.click(screen.getByRole('button', {name: i18n.t('common:actions.save')}));
    for (const locale of SUPPORTED_LOCALES) {
      await act(() => i18n.changeLanguage(locale));
      expect(screen.getByRole('textbox', {name: i18n.t('editor:linkUrl')})).toBe(input);
      expect(input).toHaveValue('invalid');
      expect(screen.getByRole('dialog', {name: i18n.t('editor:linkUrl')})).toBe(dialog);
      expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('editor:invalidLink'));
    }
    expect(complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: i18n.t('common:actions.cancel')}));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(null));
  });

  it('cancels an unresolved request when the editor unmounts', async () => {
    const complete = vi.fn(); const {unmount} = render(<Harness complete={complete}/>);
    fireEvent.click(screen.getByRole('button', {name: 'Open'})); unmount();
    await waitFor(() => expect(complete).toHaveBeenCalledWith(null));
  });

  it('keeps the authored content unchanged during locale changes and opens Ctrl-K in the selected locale', async () => {
    const changed = vi.fn(); const authored = 'Read the following passage carefully.';
    render(<RichTextEditor content={authored} onChange={changed}/>);
    const editor = await screen.findByRole('textbox', {name: i18n.t('editor:label')});
    for (const locale of SUPPORTED_LOCALES) {
      await act(() => i18n.changeLanguage(locale));
      expect(screen.getByRole('textbox', {name: i18n.t('editor:label')})).toBe(editor);
      expect(editor).toHaveTextContent(authored);
    }
    expect(changed).not.toHaveBeenCalled();
    fireEvent.keyDown(editor, {key: 'k', ctrlKey: true});
    expect(await screen.findByRole('dialog', {name: i18n.t('editor:linkUrl')})).toBeVisible();
  });

  it('does not apply a pending link to a changed document and rejects unsafe schemes', async () => {
    const editor = new Editor({extensions: createEditorExtensions({placeholder: '', disabled: false}), content: '<p>Original question</p>'});
    editor.commands.selectAll();
    let resolve: (value: string | null) => void = () => {};
    const prompt = vi.fn<ReturnType<typeof useTextPromptDialog>['prompt']>(request => {
      expect(request.validate?.('javascript:alert(1)')).toBe('editor:invalidLink');
      expect(request.validate?.('https://example.com')).toBeUndefined();
      return new Promise(done => {resolve = done;});
    });
    const pending = editLink(editor, prompt);
    editor.commands.setContent('<p>Replacement question</p>');
    resolve('https://example.com'); await pending;
    expect(editor.getHTML()).toBe('<p>Replacement question</p>');
    editor.destroy();
  });
});
