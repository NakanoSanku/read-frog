import type { MouseEvent } from "react"
import type { WordHighlightLookupDetail } from "@/types/vocabulary"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { useSavedVocabulary } from "@/hooks/use-saved-vocabulary"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { WORD_HIGHLIGHT_CLASS, WORD_HIGHLIGHT_LOOKUP_EVENT } from "@/utils/constants/vocabulary"
import { i18n } from "@/utils/i18n"
import { createVocabularyMatcher } from "@/utils/vocabulary/matcher"

export function VocabularyHighlightedText({
  text,
  context = text,
}: {
  text: string
  context?: string
}) {
  const entries = useSavedVocabulary()
  const { wordHighlight } = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const matcher = useMemo(() => createVocabularyMatcher(entries), [entries])
  const segments = useMemo(
    () => (wordHighlight.enabled ? matcher.split(text) : [{ text }]),
    [matcher, text, wordHighlight.enabled],
  )

  const openLookup = (event: MouseEvent<HTMLSpanElement>, term: string) => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return

    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const detail: WordHighlightLookupDetail = {
      term,
      context,
      anchor: { x: rect.left, y: rect.bottom },
    }
    window.dispatchEvent(
      new CustomEvent<WordHighlightLookupDetail>(WORD_HIGHLIGHT_LOOKUP_EVENT, { detail }),
    )
  }

  return segments.map((segment, index) =>
    segment.entry ? (
      <span
        // Segment positions are stable for the lifetime of this subtitle frame.
        // oxlint-disable-next-line react/no-array-index-key
        key={index}
        className={WORD_HIGHLIGHT_CLASS}
        data-read-frog-word-highlight={segment.entry.term}
        title={i18n.t("wordHighlight.clickToLookUp")}
        onClick={(event) => openLookup(event, segment.text)}
      >
        {segment.text}
      </span>
    ) : (
      segment.text
    ),
  )
}
