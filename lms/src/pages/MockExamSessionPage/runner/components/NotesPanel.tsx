import { useTranslation } from 'react-i18next';
import { useState } from 'react'
import type { NoteItem } from '../types/annotation'

type NotesPanelProps = {
  notes: NoteItem[]
  onAdd: (text: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function NotesPanel({ notes, onAdd, onDelete, onClose }: NotesPanelProps) {
  const { t: translate } = useTranslation();
  const [draft, setDraft] = useState('')

  const handleAdd = () => {
    const text = draft.trim()
    if (!text) return
    onAdd(text)
    setDraft('')
  }

  return (
    <div className="notes-panel" role="dialog" aria-label={translate("exams:schema.notes")}>
      <div className="notes-panel__header">
        <h3>{translate("exams:schema.notes")}</h3>
        <button type="button" className="notes-panel__close" onClick={onClose} aria-label={translate('exams:runner.closeNotes')}>
          ×
        </button>
      </div>
      <textarea
        className="notes-panel__input"
        rows={4}
        placeholder={translate('exams:runner.notePlaceholder')}
        aria-label={translate('exams:schema.notes')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button type="button" className="notes-panel__add" onClick={handleAdd}>{translate('exams:runner.addNote')}</button>
      <ul className="notes-panel__list">
        {notes.length === 0 ? (
          <li className="notes-panel__empty">{translate('exams:runner.noNotes')}</li>
        ) : (
          notes.map((note) => (
            <li key={note.id} className="notes-panel__item">
              <p>{note.text}</p>
              <button
                type="button"
                className="notes-panel__delete"
                onClick={() => onDelete(note.id)}
                aria-label={translate('exams:runner.deleteNote')}
              >
                {translate("common:actions.delete")}</button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
