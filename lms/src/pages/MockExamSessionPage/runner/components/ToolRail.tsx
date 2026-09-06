import { useTranslation } from 'react-i18next';
import type { ToolMode } from '../types/annotation'

type ToolRailProps = {
  activeTool: ToolMode
  onToggleHighlight: () => void
  onToggleNotes: () => void
}

export function ToolRail({ activeTool, onToggleHighlight, onToggleNotes }: ToolRailProps) {
  const { t: translate } = useTranslation();
  return (
    <aside className="tool-rail" aria-label={translate('exams:runner.tools')}>
      <button
        type="button"
        className={`tool-rail__btn ${activeTool === 'highlight' ? 'is-active' : ''}`}
        title={translate('exams:runner.highlight')}
        aria-pressed={activeTool === 'highlight'}
        onClick={onToggleHighlight}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M4 20l4.5-1.2L19 8.3a2 2 0 0 0 0-2.8l-.5-.5a2 2 0 0 0-2.8 0L5.2 15.5 4 20z" />
          <path d="M13.5 7.5l3 3" />
        </svg>
      </button>
      <button
        type="button"
        className={`tool-rail__btn ${activeTool === 'notes' ? 'is-active' : ''}`}
        title={translate("exams:schema.notes")}
        aria-pressed={activeTool === 'notes'}
        onClick={onToggleNotes}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M6 4h9l3 3v13H6V4z" />
          <path d="M15 4v3h3M8 11h8M8 15h6" />
        </svg>
      </button>
    </aside>
  )
}
