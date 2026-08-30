import { useState } from 'react'
import type { NoteItem } from '../types/annotation'

type NotesPanelProps = {
  notes: NoteItem[]
  onAdd: (text: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function NotesPanel({ notes, onAdd, onDelete, onClose }: NotesPanelProps) {
  const [draft, setDraft] = useState('')

  const handleAdd = () => {
    const text = draft.trim()
    if (!text) return
    onAdd(text)
    setDraft('')
  }

  return (
    <div className="notes-panel" role="dialog" aria-label="Notes">
      <div className="notes-panel__header">
        <h3>Notes</h3>
        <button type="button" className="notes-panel__close" onClick={onClose} aria-label="Close notes">
          ×
        </button>
      </div>
      <textarea
        className="notes-panel__input"
        rows={4}
        placeholder="Write a note for this passage…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button type="button" className="notes-panel__add" onClick={handleAdd}>
        Add note
      </button>
      <ul className="notes-panel__list">
        {notes.length === 0 ? (
          <li className="notes-panel__empty">No notes yet.</li>
        ) : (
          notes.map((note) => (
            <li key={note.id} className="notes-panel__item">
              <p>{note.text}</p>
              <button
                type="button"
                className="notes-panel__delete"
                onClick={() => onDelete(note.id)}
                aria-label="Delete note"
              >
                Delete
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
