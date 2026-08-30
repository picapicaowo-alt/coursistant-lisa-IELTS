export type TextSpan = {
  id: string
  paragraphIndex: number
  start: number
  end: number
  text: string
}

export type NoteItem = {
  id: string
  text: string
  createdAt: number
}

export type ToolMode = 'highlight' | 'notes' | null
