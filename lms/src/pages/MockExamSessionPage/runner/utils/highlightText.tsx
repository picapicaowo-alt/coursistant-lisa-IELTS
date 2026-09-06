import type { ReactNode } from 'react'
import i18n from '@/i18n';
import type { TextSpan } from '../types/annotation'

export function renderHighlightedParagraph(
  text: string,
  highlights: TextSpan[],
  paragraphIndex: number,
  onRemove: (id: string) => void,
): ReactNode[] {
  const marks = highlights
    .filter((h) => h.paragraphIndex === paragraphIndex)
    .sort((a, b) => a.start - b.start)

  const nodes: ReactNode[] = []
  let cursor = 0

  for (const mark of marks) {
    if (mark.end <= cursor || mark.start >= text.length) continue
    const start = Math.max(mark.start, cursor)
    const end = Math.min(mark.end, text.length)
    if (start > cursor) {
      nodes.push(text.slice(cursor, start))
    }
    nodes.push(
      <mark
        key={mark.id}
        className="passage-highlight"
        title={i18n.t('exams:runner.removeHighlight')}
        onClick={(e) => {
          e.stopPropagation()
          onRemove(mark.id)
        }}
      >
        {text.slice(start, end)}
      </mark>,
    )
    cursor = end
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes
}

export function selectionOffsetsInParagraph(
  paragraphEl: HTMLElement,
  range: Range,
): { start: number; end: number } | null {
  if (!paragraphEl.contains(range.commonAncestorContainer)) return null

  const preRange = range.cloneRange()
  preRange.selectNodeContents(paragraphEl)
  preRange.setEnd(range.startContainer, range.startOffset)
  const start = preRange.toString().length
  const end = start + range.toString().length
  if (end <= start) return null
  return { start, end }
}
