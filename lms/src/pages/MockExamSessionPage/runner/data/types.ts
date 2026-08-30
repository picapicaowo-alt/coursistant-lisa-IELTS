export type GapBlank = {
  id: number
  before: string
  after: string
}

export type NoteBlock = {
  heading: string
  blanks: GapBlank[]
}

export type TfngQuestion = {
  id: number
  statement: string
}

export type McqQuestion = {
  id: number
  prompt: string
  options: string[]
}

export type MatchingQuestion = {
  id: number
  statement: string
}

export type Choice = { key: string; text: string }

export type TableCell =
  | { type: 'text'; value: string }
  | { type: 'gap'; id: number }

export type FlowStep =
  | { type: 'text'; value: string }
  | { type: 'gap'; id: number; before?: string; after?: string }

export type SummaryPart =
  | { type: 'text'; value: string }
  | { type: 'gap'; id: number }

/** Notes / summary-style completion with headings */
export type NotesSection = {
  kind: 'notes'
  title: string
  instruction: string
  blocks: NoteBlock[]
}

/** Sentence completion */
export type SentenceCompletionSection = {
  kind: 'sentenceCompletion'
  title: string
  instruction: string
  questions: GapBlank[]
}

/** Summary completion with a word bank */
export type SummaryBankSection = {
  kind: 'summaryBank'
  title: string
  instruction: string
  wordBank: string[]
  parts: SummaryPart[]
}

/** TRUE/FALSE/NOT GIVEN or YES/NO/NOT GIVEN */
export type TfngSection = {
  kind: 'tfng'
  title: string
  instruction: string
  questions: TfngQuestion[]
  options?: readonly string[]
  /** 'claims' uses writer-claims wording for Y/N/NG */
  agreementTarget?: 'information' | 'claims'
}

/** Single-answer multiple choice */
export type McqSection = {
  kind: 'mcq'
  title: string
  instruction: string
  questions: McqQuestion[]
}

/** Choose TWO / THREE letters (maps onto consecutive question ids) */
export type MultiSelectSection = {
  kind: 'multiSelect'
  title: string
  instruction: string
  prompt: string
  chooseCount: number
  questionIds: number[]
  options: string[]
}

/** Matching information / features */
export type MatchingSection = {
  kind: 'matching'
  title: string
  instruction: string
  listLabel: string
  choices: Choice[]
  questions: MatchingQuestion[]
}

/** Matching headings to paragraphs */
export type HeadingsSection = {
  kind: 'headings'
  title: string
  instruction: string
  listLabel: string
  headings: Choice[]
  questions: { id: number; paragraphLabel: string }[]
}

/** Matching sentence endings */
export type SentenceEndingsSection = {
  kind: 'sentenceEndings'
  title: string
  instruction: string
  listLabel: string
  endings: Choice[]
  questions: { id: number; stem: string }[]
}

/** Table completion */
export type TableSection = {
  kind: 'table'
  title: string
  instruction: string
  caption?: string
  headers: string[]
  rows: TableCell[][]
}

/** Flow-chart completion */
export type FlowchartSection = {
  kind: 'flowchart'
  title: string
  instruction: string
  steps: FlowStep[]
}

/** Diagram label completion: image + separate answer list */
export type DiagramSection = {
  kind: 'diagram'
  title: string
  instruction: string
  caption: string
  imageSrc: string
  imageAlt: string
  labels: { id: number; prompt: string }[]
}

/** Short-answer questions */
export type ShortAnswerSection = {
  kind: 'shortAnswer'
  title: string
  instruction: string
  questions: { id: number; prompt: string }[]
}

export type QuestionSection =
  | NotesSection
  | SentenceCompletionSection
  | SummaryBankSection
  | TfngSection
  | McqSection
  | MultiSelectSection
  | MatchingSection
  | HeadingsSection
  | SentenceEndingsSection
  | TableSection
  | FlowchartSection
  | DiagramSection
  | ShortAnswerSection

export type PassageData = {
  id: number
  shortLabel: string
  title: string
  intro: string
  paragraphs: string[]
  questionNumbers: number[]
  sections: QuestionSection[]
}

export const TFNG_OPTIONS = ['TRUE', 'FALSE', 'NOT GIVEN'] as const
export const YNNG_OPTIONS = ['YES', 'NO', 'NOT GIVEN'] as const
