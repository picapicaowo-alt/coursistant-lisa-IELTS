import {useTranslation} from 'react-i18next';
import { useCallback } from 'react'
import type { PassageData } from '../data/types'
import type { TextSpan } from '../types/annotation'
import {
  renderHighlightedParagraph,
  selectionOffsetsInParagraph,
} from '../utils/highlightText'

type PassagePaneProps = {
  passage: PassageData
  highlightMode: boolean
  highlights: TextSpan[]
  onAddHighlight: (span: Omit<TextSpan, 'id'>) => void
  onRemoveHighlight: (id: string) => void
}

export function PassagePane({
  passage,
  highlightMode,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
}: PassagePaneProps) {
  const {t: translate} = useTranslation();
  const handleMouseUp = useCallback(() => {
    if (!highlightMode) return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const selectedText = range.toString().trim()
    if (!selectedText) return

    const paragraphEl = (
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as HTMLElement)
        : range.commonAncestorContainer.parentElement
    )?.closest<HTMLElement>('[data-para-index]')

    if (!paragraphEl) return

    const paragraphIndex = Number(paragraphEl.dataset.paraIndex)
    if (Number.isNaN(paragraphIndex)) return

    const offsets = selectionOffsetsInParagraph(paragraphEl, range)
    if (!offsets) return

    onAddHighlight({
      paragraphIndex,
      start: offsets.start,
      end: offsets.end,
      text: selectedText,
    })
    selection.removeAllRanges()
  }, [highlightMode, onAddHighlight])

  return (
    <section
      className={`passage-pane ${highlightMode ? 'is-highlight-mode' : ''}`}
      aria-label={translate('exams:runner.readingPassage')}
      onMouseUp={handleMouseUp}
    >
      {highlightMode ? (
        <div className="highlight-hint">{translate('exams:runner.highlightHelp')}</div>
      ) : null}
      <article className="passage">
        <h1 className="passage__title">{passage.title}</h1>
        <p className="passage__intro">{passage.intro}</p>
        {passage.paragraphs.map((paragraph, index) => (
          <p key={index} className="passage__paragraph" data-para-index={index}>
            {renderHighlightedParagraph(paragraph, highlights, index, onRemoveHighlight)}
          </p>
        ))}
      </article>
    </section>
  )
}
