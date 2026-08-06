import type { SavedVocabularyEntry, SaveVocabularyEntryInput } from "@/types/vocabulary"
import { storage } from "#imports"
import {
  MAX_SAVED_VOCABULARY_CONTEXT_LENGTH,
  MAX_SAVED_VOCABULARY_ENTRIES,
  MAX_SAVED_VOCABULARY_TERM_LENGTH,
  SAVED_VOCABULARY_STORAGE_KEY,
} from "@/utils/constants/vocabulary"

const STORAGE_KEY = `local:${SAVED_VOCABULARY_STORAGE_KEY}` as const

function cleanOptionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim()
  return text ? text.slice(0, maxLength) : undefined
}

function cleanSourceUrl(value: unknown): string | undefined {
  const text = cleanOptionalText(value, 1000)
  if (!text) return undefined
  try {
    const url = new URL(text)
    url.search = ""
    url.hash = ""
    return url.toString().slice(0, 1000)
  } catch {
    return text
  }
}

export function normalizeVocabularyTerm(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase()
}

function sanitizeEntry(value: unknown): SavedVocabularyEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const candidate = value as Partial<SavedVocabularyEntry>
  if (typeof candidate.term !== "string") return null

  const term = candidate.term.replace(/\s+/g, " ").trim().slice(0, MAX_SAVED_VOCABULARY_TERM_LENGTH)
  const normalizedTerm = normalizeVocabularyTerm(term)
  if (!normalizedTerm) return null

  const createdAt =
    typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
      ? candidate.createdAt
      : Date.now()
  const updatedAt =
    typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
      ? candidate.updatedAt
      : createdAt

  return {
    id: normalizedTerm,
    term,
    normalizedTerm,
    createdAt,
    updatedAt,
    context: cleanOptionalText(candidate.context, MAX_SAVED_VOCABULARY_CONTEXT_LENGTH),
    sourceTitle: cleanOptionalText(candidate.sourceTitle, 300),
    sourceUrl: cleanSourceUrl(candidate.sourceUrl),
    languageCode: cleanOptionalText(candidate.languageCode, 32),
  }
}

export function sanitizeSavedVocabulary(value: unknown): SavedVocabularyEntry[] {
  if (!Array.isArray(value)) return []

  const entriesByTerm = new Map<string, SavedVocabularyEntry>()
  for (const valueEntry of value) {
    const entry = sanitizeEntry(valueEntry)
    if (!entry) continue

    const existing = entriesByTerm.get(entry.normalizedTerm)
    if (!existing || entry.updatedAt >= existing.updatedAt) {
      entriesByTerm.set(entry.normalizedTerm, entry)
    }
  }

  return [...entriesByTerm.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SAVED_VOCABULARY_ENTRIES)
}

export async function getSavedVocabulary(): Promise<SavedVocabularyEntry[]> {
  return sanitizeSavedVocabulary(await storage.getItem<unknown>(STORAGE_KEY))
}

let writeQueue: Promise<unknown> = Promise.resolve()

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task, task)
  writeQueue = next.catch(() => undefined)
  return next
}

export function saveVocabularyEntry(
  input: SaveVocabularyEntryInput,
): Promise<SavedVocabularyEntry | null> {
  return enqueueWrite(async () => {
    const term = input.term.replace(/\s+/g, " ").trim().slice(0, MAX_SAVED_VOCABULARY_TERM_LENGTH)
    const normalizedTerm = normalizeVocabularyTerm(term)
    if (!normalizedTerm) return null

    const entries = await getSavedVocabulary()
    const existing = entries.find((entry) => entry.normalizedTerm === normalizedTerm)
    const now = Date.now()
    const entry = sanitizeEntry({
      ...existing,
      id: normalizedTerm,
      term,
      normalizedTerm,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      context: input.context ?? existing?.context,
      sourceTitle: input.sourceTitle ?? existing?.sourceTitle,
      sourceUrl: input.sourceUrl ?? existing?.sourceUrl,
      languageCode: input.languageCode ?? existing?.languageCode,
    })
    if (!entry) return null

    const nextEntries = [
      entry,
      ...entries.filter((candidate) => candidate.normalizedTerm !== normalizedTerm),
    ].slice(0, MAX_SAVED_VOCABULARY_ENTRIES)
    await storage.setItem(STORAGE_KEY, nextEntries)
    return entry
  })
}

export function removeVocabularyEntry(term: string): Promise<boolean> {
  return enqueueWrite(async () => {
    const normalizedTerm = normalizeVocabularyTerm(term)
    const entries = await getSavedVocabulary()
    const nextEntries = entries.filter((entry) => entry.normalizedTerm !== normalizedTerm)
    if (nextEntries.length === entries.length) return false

    await storage.setItem(STORAGE_KEY, nextEntries)
    return true
  })
}

export function clearSavedVocabulary(): Promise<void> {
  return enqueueWrite(async () => {
    await storage.setItem<SavedVocabularyEntry[]>(STORAGE_KEY, [])
  })
}

export function watchSavedVocabulary(
  listener: (entries: SavedVocabularyEntry[]) => void,
): () => void {
  return storage.watch<unknown>(STORAGE_KEY, (value) => listener(sanitizeSavedVocabulary(value)))
}
