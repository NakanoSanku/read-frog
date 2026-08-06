import type { SavedVocabularyEntry } from "@/types/vocabulary"
import { normalizeVocabularyTerm } from "./storage"

export interface VocabularyTextSegment {
  text: string
  entry?: SavedVocabularyEntry
}

const WORD_CHARACTER_SOURCE = "[\\p{L}\\p{N}\\p{M}]"
const CONTINUOUS_SCRIPT_RE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u
const WORD_CHARACTER_RE = /[\p{L}\p{N}\p{M}]/u

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
}

function buildTermPattern(term: string) {
  const usesContinuousScript = CONTINUOUS_SCRIPT_RE.test(term)
  const firstCharacter = term.match(/^./u)?.[0] ?? ""
  const lastCharacter = term.match(/.$/u)?.[0] ?? ""
  const leftBoundary = !usesContinuousScript && WORD_CHARACTER_RE.test(firstCharacter)
  const rightBoundary = !usesContinuousScript && WORD_CHARACTER_RE.test(lastCharacter)

  return `${leftBoundary ? `(?<!${WORD_CHARACTER_SOURCE})` : ""}${escapeRegex(term)}${rightBoundary ? `(?!${WORD_CHARACTER_SOURCE})` : ""}`
}

export interface VocabularyMatcher {
  split: (text: string) => VocabularyTextSegment[]
}

export function createVocabularyMatcher(
  entries: readonly SavedVocabularyEntry[],
): VocabularyMatcher {
  const uniqueEntries = new Map<string, SavedVocabularyEntry>()
  for (const entry of entries) {
    if (!uniqueEntries.has(entry.normalizedTerm)) uniqueEntries.set(entry.normalizedTerm, entry)
  }

  const sortedEntries = [...uniqueEntries.values()].sort(
    (a, b) => b.term.length - a.term.length || a.normalizedTerm.localeCompare(b.normalizedTerm),
  )
  if (sortedEntries.length === 0) {
    return { split: (text) => [{ text }] }
  }

  const regex = new RegExp(
    sortedEntries.map((entry) => buildTermPattern(entry.term)).join("|"),
    "giu",
  )

  return {
    split(text) {
      if (!text) return []

      const segments: VocabularyTextSegment[] = []
      let cursor = 0
      regex.lastIndex = 0
      for (const match of text.matchAll(regex)) {
        const index = match.index
        const matchedText = match[0]
        if (index > cursor) segments.push({ text: text.slice(cursor, index) })

        const entry = uniqueEntries.get(normalizeVocabularyTerm(matchedText))
        segments.push(entry ? { text: matchedText, entry } : { text: matchedText })
        cursor = index + matchedText.length
      }

      if (cursor < text.length) segments.push({ text: text.slice(cursor) })
      return segments.length > 0 ? segments : [{ text }]
    },
  }
}
