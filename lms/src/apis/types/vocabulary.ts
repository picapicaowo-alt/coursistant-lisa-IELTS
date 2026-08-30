export const STUDY_MODES = ['REMEMBER', 'TEST'] as const;
export type StudyMode = typeof STUDY_MODES[number];

export const RECALL_RATINGS = ['KNOW_WELL', 'KIND_OF_KNOW', 'DONT_REMEMBER'] as const;
export type RecallRating = typeof RECALL_RATINGS[number];
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ENDED';

export interface VocabularyProgress {
  clearedWords: number;
  totalWords: number;
  completionCount: number;
}

export interface VocabularyListSummary {
  id: string;
  name: string;
  description: string;
  totalWords: number;
  theme: string;
  skillFocus: string;
  difficulty: string;
  progress: VocabularyProgress;
}

export interface VocabularyFilters {
  themes: string[];
  skillFocuses: string[];
  difficulties: string[];
}

export interface ContinueStudy {
  listId: string;
  listName: string;
  unitId: string;
  unitName: string;
  sessionId: string;
  mode: StudyMode;
}

export interface VocabularyListCollectionResponse {
  items: VocabularyListSummary[];
  filters: VocabularyFilters;
  continue: ContinueStudy | null;
}

export interface UnitProgress extends VocabularyProgress {
  readyForReview: number;
}

export interface VocabularyUnitSummary {
  id: string;
  number: number;
  name: string;
  wordCount: number;
  progress: UnitProgress;
  activeSessionId: string | null;
  activeSession: ActiveSessionSummary | null;
}

export interface ActiveSessionSummary {
  id: string;
  mode: StudyMode;
  status: 'ACTIVE' | 'PAUSED';
  position: number;
  totalScheduled: number;
}

export interface VocabularyListDetailResponse extends VocabularyListSummary {
  units: VocabularyUnitSummary[];
}

export interface VocabularyUnitResponse extends VocabularyUnitSummary {
  listId: string;
  listName: string;
}

export interface WordAnswer {
  ukPhonetic: string;
  usPhonetic: string | null;
  audioUrl: string | null;
  primaryMeaningZh: string;
  secondaryMeaningsZh: string[];
  exampleEn: string;
  exampleZh: string;
}

export interface StudyCard {
  wordId: string;
  word: string;
  partOfSpeech: string;
  answer: WordAnswer | null;
}

export interface SessionSummary {
  clearedThisSession: number;
  currentPassCleared: number;
  currentPassTotal: number;
  carriedForward: number;
  unitCompletionOccurred: boolean;
  unitCompletionCount: number;
}

export interface StudySessionResponse {
  id: string;
  unitId: string;
  mode: StudyMode;
  status: SessionStatus;
  position: number;
  totalScheduled: number;
  revealed: boolean;
  canGoPrevious: boolean;
  currentCard: StudyCard | null;
  summary: SessionSummary | null;
}

export interface StartSessionRequest {
  mode: StudyMode;
  shuffle?: boolean;
}

export interface RateCardRequest {
  wordId: string;
  rating: RecallRating;
}

export interface AdvanceSessionRequest {
  direction: 'NEXT' | 'PREVIOUS';
}
