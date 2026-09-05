import { useTranslation } from 'react-i18next';
import React from 'react';
import {useEditorState} from '@tiptap/react';
import type {Editor} from '@tiptap/react';
import {Level} from '@tiptap/extension-heading';
import {
  Check,
  ChevronDown,
  CodeXml,
  FilePlus2,
  ImagePlus,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  PanelTopClose,
  PanelTopOpen,
  Quote,
  Video,
} from 'lucide-react';
import styles from './index.module.scss';
import MediaInsertDialog from './MediaInsertDialog';
import type {MediaInsertPayload} from './MediaInsertDialog';
import {editLink, useTextPromptDialog} from './useTextPromptDialog';

interface ToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
  toolbarVisible?: boolean;
  toggleToolbar?: () => void;
}

const isApplePlatform = () => {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPad|iPhone|iPod/i.test(navigator.platform || navigator.userAgent);
};

const shortcut = (key: string, {shift = false, alt = false} = {}) => {
  if (isApplePlatform()) return `${alt ? '⌥' : ''}${shift ? '⇧' : ''}⌘${key}`;
  return `Ctrl+${alt ? 'Alt+' : ''}${shift ? 'Shift+' : ''}${key}`;
};

const TEXT_COLORS = [
  {name: "editor:color.default", value: ''},
  {name: "editor:color.black", value: '#000000'},
  {name: "editor:color.gray", value: '#64748B'},
  {name: "editor:color.red", value: '#DC2626'},
  {name: "editor:color.orange", value: '#EA580C'},
  {name: "editor:color.yellow", value: '#EAB308'},
  {name: "editor:color.green", value: '#16A34A'},
  {name: "editor:color.teal", value: '#0D9488'},
  {name: "editor:color.blue", value: '#2563EB'},
  {name: "editor:color.purple", value: '#9333EA'},
  {name: "editor:color.pink", value: '#DB2777'},
];

interface ToolbarButtonProps {
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({label, hint, active, onClick, children}) => (
  <button
    type="button"
    onMouseDown={event => event.preventDefault()}
    onClick={onClick}
    aria-label={label}
    aria-pressed={active}
    data-tooltip={hint ? `${label} · ${hint}` : label}
    className={`${styles.toolbarButton} ${styles.tooltipHost} ${active ? styles.active : ''}`}
  >
    {children}
  </button>
);

const Toolbar: React.FC<ToolbarProps> = ({editor, disabled, toolbarVisible = true, toggleToolbar}) => {
  const { t: translate } = useTranslation();
  const {prompt, dialog} = useTextPromptDialog();
  const colorMenuRef = React.useRef<HTMLDetailsElement>(null);
  const insertMenuRef = React.useRef<HTMLDetailsElement>(null);
  const [insertOpen, setInsertOpen] = React.useState(false);
  const formattingState = useEditorState({
    editor,
    selector: ({editor: currentEditor}) => ({
      headingLevel: Number(currentEditor?.getAttributes('heading').level ?? 0),
      bold: currentEditor?.isActive('bold') ?? false,
      italic: currentEditor?.isActive('italic') ?? false,
      underline: currentEditor?.isActive('underline') ?? false,
      strike: currentEditor?.isActive('strike') ?? false,
      bulletList: currentEditor?.isActive('bulletList') ?? false,
      orderedList: currentEditor?.isActive('orderedList') ?? false,
      link: currentEditor?.isActive('link') ?? false,
      blockquote: currentEditor?.isActive('blockquote') ?? false,
      code: currentEditor?.isActive('code') ?? false,
      textColor: String(currentEditor?.getAttributes('textColor').color ?? '').toLowerCase(),
    }),
  });

  if (!editor || disabled) return null;

  const headings = [
    {level: 0, label: "editor:normal"},
    {level: 1, label: "editor:heading1"},
    {level: 2, label: "editor:heading2"},
    {level: 3, label: "editor:heading3"},
  ];

  const closeMenu = (ref: React.RefObject<HTMLDetailsElement | null>) => {
    if (ref.current) ref.current.open = false;
  };

  const toggleLink = () => {
    void editLink(editor, prompt);
  };

  const activeColor = formattingState?.textColor ?? '';

  const toggleInlineMark = (mark: 'bold' | 'italic' | 'underline' | 'strike' | 'code') => {
    editor.chain().focus().toggleMark(mark, {}, {extendEmptyMarkRange: true}).run();
  };

  const applyColor = (value: string) => {
    if (value) editor.chain().focus().setMark('textColor', {color: value}).run();
    else editor.chain().focus().unsetMark('textColor').run();
    closeMenu(colorMenuRef);
  };

  const openInsertDialog = () => {
    closeMenu(insertMenuRef);
    setInsertOpen(true);
  };

  const insertUploadedMedia = (payload: MediaInsertPayload) => {
    if (payload.kind === 'image') {
      editor.chain().focus().insertContent([
        {type: 'richImage', attrs: {src: payload.url, alt: payload.name}},
        {type: 'paragraph'},
      ]).run();
    } else if (payload.kind === 'video') {
      editor.chain().focus().insertContent([
        {type: 'richVideo', attrs: {src: payload.url}},
        {type: 'paragraph'},
      ]).run();
    } else {
      editor.chain().focus().insertContent({
        type: 'text',
        text: payload.name,
        marks: [{type: 'link', attrs: {href: payload.url, target: '_blank', rel: 'noopener noreferrer'}}],
      }).run();
    }
    setInsertOpen(false);
  };

  const insertDivider = () => {
    closeMenu(insertMenuRef);
    editor.chain().focus().setHorizontalRule().run();
  };

  return (
    <div className={styles.toolbarContainer} aria-label={translate("editor:toolbar")}>
      {insertOpen ? (
        <MediaInsertDialog
          onClose={() => setInsertOpen(false)}
          onInsert={insertUploadedMedia}
        />
      ) : null}
      {toolbarVisible ? (
        <>
          <div className={styles.toolbarGroup}>
            <select
              aria-label={translate("editor:textStyle")}
              title={translate("editor:textStyle")}
              value={formattingState?.headingLevel ?? 0}
              onChange={event => {
                const level = Number(event.target.value);
                if (level === 0) editor.chain().focus().setParagraph().run();
                else editor.chain().focus().toggleHeading({level: level as Level}).run();
              }}
              className={styles.toolbarSelect}
            >
              {headings.map(heading => <option key={heading.level} value={heading.level}>{translate(heading.label)}</option>)}
            </select>
          </div>

          <div className={styles.toolbarGroup}>
            <ToolbarButton label={translate("editor:bold")} hint={shortcut('B')} active={formattingState?.bold} onClick={() => toggleInlineMark('bold')}>
              <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton label={translate("editor:italic")} hint={shortcut('I')} active={formattingState?.italic} onClick={() => toggleInlineMark('italic')}>
              <em>I</em>
            </ToolbarButton>
            <ToolbarButton label={translate("editor:underline")} hint={shortcut('U')} active={formattingState?.underline} onClick={() => toggleInlineMark('underline')}>
              <u>U</u>
            </ToolbarButton>
            <ToolbarButton label={translate("editor:strikethrough")} hint={shortcut('S', {shift: true})} active={formattingState?.strike} onClick={() => toggleInlineMark('strike')}>
              <s>S</s>
            </ToolbarButton>
          </div>

          <div className={styles.toolbarGroup}>
            <ToolbarButton label={translate("editor:bulletList")} hint={shortcut('8', {shift: true})} active={formattingState?.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <List size={17}/>
            </ToolbarButton>
            <ToolbarButton label={translate("editor:numberedList")} hint={shortcut('7', {shift: true})} active={formattingState?.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <ListOrdered size={17}/>
            </ToolbarButton>
          </div>

          <div className={styles.toolbarGroup}>
            <details className={styles.toolbarMenu} ref={colorMenuRef}>
              <summary className={`${styles.toolbarButton} ${styles.tooltipHost}`} aria-label={translate("editor:textColor")} data-tooltip={translate("editor:textColor")}>
                <Palette size={16} color={activeColor || undefined}/><ChevronDown size={13}/>
              </summary>
              <div className={styles.colorMenu}>
                <p className={styles.menuLabel}>{translate("editor:textColor")}</p>
                <div className={styles.colorGrid}>
                  {TEXT_COLORS.map(color => {
                    const selected = activeColor === color.value.toLowerCase();
                    return (
                      <button
                        key={color.name}
                        type="button"
                        aria-label={translate(color.name)}
                        aria-pressed={selected}
                        data-tooltip={translate(color.name)}
                        className={`${styles.colorSwatch} ${styles.tooltipHost} ${selected ? styles.colorSwatchSelected : ''}`}
                        onClick={() => applyColor(color.value)}
                      >
                        <span
                          className={color.value ? styles.swatchDot : `${styles.swatchDot} ${styles.swatchDotDefault}`}
                          style={color.value ? {backgroundColor: color.value} : undefined}
                          aria-hidden="true"
                        >
                          {selected ? <Check size={12} strokeWidth={3}/> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
            <ToolbarButton label={translate("editor:insertLink")} hint={shortcut('K')} active={formattingState?.link} onClick={toggleLink}>
              <Link2 size={16}/>
            </ToolbarButton>
            <ToolbarButton label={translate("editor:blockquote")} hint={shortcut('B', {shift: true})} active={formattingState?.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              <Quote size={16}/>
            </ToolbarButton>
            <ToolbarButton label={translate("editor:inlineCode")} hint={shortcut('E')} active={formattingState?.code} onClick={() => toggleInlineMark('code')}>
              <CodeXml size={17}/>
            </ToolbarButton>
          </div>

          <div className={styles.toolbarGroup}>
            <details className={styles.toolbarMenu} ref={insertMenuRef}>
              <summary className={styles.insertButton}>{translate("editor:insert")}<ChevronDown size={14}/></summary>
              <div className={styles.insertMenu}>
                <button type="button" onClick={openInsertDialog}><ImagePlus size={16}/>{translate("editor:image")}</button>
                <button type="button" onClick={openInsertDialog}><Video size={16}/>{translate("editor:video")}</button>
                <button type="button" onClick={openInsertDialog}><FilePlus2 size={16}/>{translate("editor:file")}</button>
                <button type="button" onClick={insertDivider}><Minus size={16}/>{translate("editor:divider")}</button>
              </div>
            </details>
          </div>
        </>
      ) : null}

      <div className={styles.toolbarGroup}>
        <ToolbarButton
          label={toolbarVisible ? translate("editor:collapseToolbar") : translate("editor:expandToolbar")}
          onClick={() => toggleToolbar?.()}
        >
          {toolbarVisible ? <PanelTopClose size={17}/> : <PanelTopOpen size={17}/>}
          <span className={styles.visuallyHidden}>{toolbarVisible ? translate("editor:hide") : translate("editor:format")}</span>
        </ToolbarButton>
      </div>
      {dialog}
    </div>
  );
};

export default Toolbar;
