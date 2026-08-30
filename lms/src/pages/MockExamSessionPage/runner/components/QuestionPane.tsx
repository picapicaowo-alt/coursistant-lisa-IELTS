import type { PassageData } from '../data/types'
import type { NoteItem, ToolMode } from '../types/annotation'
import { NotesPanel } from './NotesPanel'
import type { QuestionReview } from './QuestionReviewMark'
import { SectionView } from './QuestionSections'
import { ToolRail } from './ToolRail'

type QuestionPaneProps = {
  passage: PassageData
  answers: Record<number, string>
  currentQuestion: number
  activeTool: ToolMode
  notes: NoteItem[]
  reviewByQuestion?: Record<number, QuestionReview> | null
  onAnswerChange: (id: number, value: string) => void
  onSelectQuestion: (id: number) => void
  onToggleHighlight: () => void
  onToggleNotes: () => void
  onAddNote: (text: string) => void
  onDeleteNote: (id: string) => void
  onPrev: () => void
  onNext: () => void
}

export function QuestionPane({
  passage,
  answers,
  currentQuestion,
  activeTool,
  notes,
  reviewByQuestion = null,
  onAnswerChange,
  onSelectQuestion,
  onToggleHighlight,
  onToggleNotes,
  onAddNote,
  onDeleteNote,
  onPrev,
  onNext,
}: QuestionPaneProps) {
  return (
    <section className="question-pane" aria-label="Questions">
      <div className="question-pane__scroll" key={passage.id}>
        {passage.sections.map((section) => (
          <SectionView
            key={section.title}
            section={section}
            answers={answers}
            currentQuestion={currentQuestion}
            reviewByQuestion={reviewByQuestion}
            onAnswerChange={onAnswerChange}
            onSelectQuestion={onSelectQuestion}
          />
        ))}
      </div>

      <ToolRail
        activeTool={activeTool}
        onToggleHighlight={onToggleHighlight}
        onToggleNotes={onToggleNotes}
      />

      {activeTool === 'notes' ? (
        <NotesPanel
          notes={notes}
          onAdd={onAddNote}
          onDelete={onDeleteNote}
          onClose={onToggleNotes}
        />
      ) : null}

      <div className="question-pane__nav">
        <button type="button" className="nav-arrow" onClick={onPrev} aria-label="Previous question">
          ‹
        </button>
        <button type="button" className="nav-arrow nav-arrow--primary" onClick={onNext} aria-label="Next question">
          ›
        </button>
      </div>
    </section>
  )
}
