export type Choice = { key: string; text: string }

export type TableCell =
  | { type: 'text'; value: string }
  | { type: 'gap'; id: number }

export type NoteBlank = {
  id: number
  before: string
  after: string
}

export type FlowStep =
  | { type: 'text'; value: string }
  | { type: 'gap'; id: number; before?: string; after?: string }

export type SummaryPart =
  | { type: 'text'; value: string }
  | { type: 'gap'; id: number }

export type TableCompletionSection = {
  kind: 'tableCompletion'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  caption?: string
  headers: string[]
  rows: TableCell[][]
}

export type NotesCompletionSection = {
  kind: 'notesCompletion'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  heading?: string
  blanks: NoteBlank[]
}

export type FormCompletionSection = {
  kind: 'formCompletion'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  formTitle: string
  fields: { label: string; id: number }[]
}

export type FlowchartCompletionSection = {
  kind: 'flowchartCompletion'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  steps: FlowStep[]
}

export type SentenceCompletionSection = {
  kind: 'sentenceCompletion'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  questions: NoteBlank[]
}

export type SummaryBankSection = {
  kind: 'summaryBank'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  wordBank: string[]
  parts: SummaryPart[]
}

export type McqSection = {
  kind: 'mcq'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  questions: { id: number; prompt: string; options: string[] }[]
}

export type MultiSelectSection = {
  kind: 'multiSelect'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  prompt: string
  chooseCount: number
  questionIds: number[]
  options: string[]
}

export type MatchingSection = {
  kind: 'matching'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  listLabel: string
  choices: Choice[]
  questions: { id: number; statement: string }[]
}

export type PlanMapSection = {
  kind: 'planMap'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  caption: string
  imageSrc: string
  imageAlt: string
  labels: { id: number; prompt: string }[]
}

export type ShortAnswerSection = {
  kind: 'shortAnswer'
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  questions: { id: number; prompt: string }[]
}

export type ListeningSection =
  | TableCompletionSection
  | NotesCompletionSection
  | FormCompletionSection
  | FlowchartCompletionSection
  | SentenceCompletionSection
  | SummaryBankSection
  | McqSection
  | MultiSelectSection
  | MatchingSection
  | PlanMapSection
  | ShortAnswerSection

export type ListeningPart = {
  id: number
  label: string
  audioSrc: string
  questionNumbers: number[]
  sections: ListeningSection[]
}

export type ListeningPaper = {
  id: number
  totalMinutes: number
  parts: ListeningPart[]
}
