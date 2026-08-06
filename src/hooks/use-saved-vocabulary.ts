import type { SavedVocabularyEntry } from "@/types/vocabulary"
import { useEffect, useMemo, useState } from "react"
import { logger } from "@/utils/logger"
import {
  getSavedVocabulary,
  normalizeVocabularyTerm,
  watchSavedVocabulary,
} from "@/utils/vocabulary/storage"

export function useSavedVocabulary() {
  const [entries, setEntries] = useState<SavedVocabularyEntry[]>([])

  useEffect(() => {
    let active = true
    let didReceiveStorageUpdate = false
    const unwatch = watchSavedVocabulary((value) => {
      didReceiveStorageUpdate = true
      if (active) setEntries(value)
    })
    void getSavedVocabulary()
      .then((value) => {
        if (active && !didReceiveStorageUpdate) setEntries(value)
      })
      .catch((error) => logger.error("Failed to load saved vocabulary", error))
    return () => {
      active = false
      unwatch()
    }
  }, [])

  return entries
}

export function useIsVocabularySaved(term: string | null | undefined) {
  const entries = useSavedVocabulary()
  const normalizedTerm = normalizeVocabularyTerm(term ?? "")

  return useMemo(
    () => entries.some((entry) => entry.normalizedTerm === normalizedTerm),
    [entries, normalizedTerm],
  )
}
