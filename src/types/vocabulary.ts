export interface SavedVocabularyEntry {
  id: string
  term: string
  normalizedTerm: string
  createdAt: number
  updatedAt: number
  context?: string
  sourceTitle?: string
  sourceUrl?: string
  languageCode?: string
}

export interface SaveVocabularyEntryInput {
  term: string
  context?: string | null
  sourceTitle?: string | null
  sourceUrl?: string | null
  languageCode?: string | null
}

export interface WordHighlightLookupDetail {
  term: string
  context: string
  anchor: {
    x: number
    y: number
  }
}
