import {Extension, InputRule} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {BlockMath, InlineMath} from '@tiptap/extension-mathematics';
import {Markdown} from '@tiptap/markdown';
import {BlankNode} from './extensions/BlankNode';
import {RichImage, RichVideo, TextColor} from './extensions/RichContent';
import {isSafeDataUrl} from './media';
import styles from './index.module.scss';

// StarterKit binds Mod-* shortcuts for marks and headings but ships none for lists.
export const ListShortcuts = Extension.create({
  name: 'listShortcuts',

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
      'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
    };
  },
});

/**
 * The mathematics package renders and serializes TeX, but its 3.15 input rules
 * expect doubled/tripled delimiters. These rules use the Markdown delimiters
 * people actually type: $...$ for inline math and $$...$$ for display math.
 */
export const MarkdownInlineMath = InlineMath.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /(^|[^$])\$([^$\n]+)\$$/,
        handler: ({state, range, match}) => {
          const prefix = match[1] ?? '';
          const latex = match[2]?.trim();
          if (!latex) return;

          state.tr.replaceWith(
            range.from + prefix.length,
            range.to,
            this.type.create({latex}),
          );
        },
      }),
    ];
  },
});

export const MarkdownBlockMath = BlockMath.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$([^$\n]+)\$\$$/,
        handler: ({state, range, match}) => {
          const latex = match[1]?.trim();
          if (!latex) return;

          const $from = state.doc.resolve(range.from);
          state.tr.replaceWith(
            $from.before(),
            $from.after(),
            this.type.create({latex}),
          );
        },
      }),
    ];
  },
});

export const createEditorExtensions = (options: {placeholder: string | (() => string); disabled: boolean}) => [
  StarterKit.configure({
    heading: {levels: [1, 2, 3]},
    link: {
      openOnClick: options.disabled,
      isAllowedUri: (url, ctx) => {
        if (!url) return true;
        if (isSafeDataUrl(url)) return true;
        return ctx.defaultValidate(url);
      },
      HTMLAttributes: {
        class: styles.link,
        rel: 'noopener noreferrer',
      },
    },
  }),
  Placeholder.configure({
    placeholder: options.placeholder,
    emptyEditorClass: styles.placeholder,
  }),
  Markdown.configure({
    indentation: {style: 'space', size: 2},
    markedOptions: {gfm: true, breaks: true},
  }),
  MarkdownInlineMath.configure({
    katexOptions: {throwOnError: false, displayMode: false},
  }),
  MarkdownBlockMath.configure({
    katexOptions: {throwOnError: false, displayMode: true},
  }),
  ListShortcuts,
  TextColor,
  RichImage,
  RichVideo,
  BlankNode.configure({mode: options.disabled ? 'student' : 'teacher'}),
];

export const extensionNames = (
  extensions: ReturnType<typeof createEditorExtensions>,
): string[] => extensions.flatMap(extension => {
  const addExtensions = (extension as {
    config?: {addExtensions?: () => {name: string}[]};
  }).config?.addExtensions;
  const nested = addExtensions ? addExtensions.call(extension) : [];
  return [extension.name, ...nested.map(child => child.name)];
});
