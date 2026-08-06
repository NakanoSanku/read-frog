import type { SavedVocabularyEntry } from "@/types/vocabulary"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { storage } from "#imports"
import { SAVED_VOCABULARY_STORAGE_KEY } from "@/utils/constants/vocabulary"
import {
  clearSavedVocabulary,
  getSavedVocabulary,
  normalizeVocabularyTerm,
  removeVocabularyEntry,
  sanitizeSavedVocabulary,
  saveVocabularyEntry,
  watchSavedVocabulary,
} from "../storage"

describe("saved vocabulary storage", () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.restoreAllMocks()
  })

  it("normalizes and de-duplicates saved terms while preserving their first creation time", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(100).mockReturnValueOnce(200)

    await saveVocabularyEntry({ term: "  New   Word  ", context: "first" })
    await saveVocabularyEntry({
      term: "new word",
      context: "second",
      sourceUrl: "https://example.com/lesson?token=secret#word",
    })

    const entries = await getSavedVocabulary()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      id: "new word",
      term: "new word",
      normalizedTerm: "new word",
      createdAt: 100,
      updatedAt: 200,
      context: "second",
      sourceUrl: "https://example.com/lesson",
    })
  })

  it("removes one term and clears the vocabulary", async () => {
    await saveVocabularyEntry({ term: "alpha" })
    await saveVocabularyEntry({ term: "beta" })

    await expect(removeVocabularyEntry("ALPHA")).resolves.toBe(true)
    expect((await getSavedVocabulary()).map((entry) => entry.term)).toEqual(["beta"])

    await clearSavedVocabulary()
    await expect(getSavedVocabulary()).resolves.toEqual([])
  })

  it("sanitizes malformed records and keeps the newest duplicate", () => {
    expect(
      sanitizeSavedVocabulary([
        null,
        { term: "Word", createdAt: 1, updatedAt: 1 },
        { term: "word", createdAt: 2, updatedAt: 3 },
        { term: "   " },
      ]),
    ).toEqual([expect.objectContaining({ term: "word", normalizedTerm: "word", updatedAt: 3 })])
    expect(normalizeVocabularyTerm("  Ｈello\tWORLD ")).toBe("hello world")
  })

  it("notifies watchers when vocabulary changes", async () => {
    const listener = vi.fn<(entries: SavedVocabularyEntry[]) => void>()
    const unwatch = watchSavedVocabulary(listener)
    await storage.setItem(`local:${SAVED_VOCABULARY_STORAGE_KEY}`, [
      { term: "watched", createdAt: 1, updatedAt: 1 },
    ])

    expect(listener).toHaveBeenCalledWith([
      expect.objectContaining({ term: "watched", normalizedTerm: "watched" }),
    ])
    unwatch()
  })
})
