// @vitest-environment jsdom

import type { SavedVocabularyEntry, WordHighlightLookupDetail } from "@/types/vocabulary"
import { fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { WORD_HIGHLIGHT_ATTRIBUTE, WORD_HIGHLIGHT_LOOKUP_EVENT } from "@/utils/constants/vocabulary"
import { PageWordHighlighter } from "../page-highlighter"
import { normalizeVocabularyTerm } from "../storage"

function entry(term: string): SavedVocabularyEntry {
  return {
    id: normalizeVocabularyTerm(term),
    term,
    normalizedTerm: normalizeVocabularyTerm(term),
    createdAt: 1,
    updatedAt: 1,
  }
}

describe("page word highlighter", () => {
  let highlighter: PageWordHighlighter

  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    highlighter = new PageWordHighlighter(document)
  })

  afterEach(() => highlighter.destroy())

  it("highlights saved words while leaving editable and code content untouched", () => {
    document.body.innerHTML = `
      <p>Learn a new word and another word.</p>
      <input value="word">
      <button>word</button>
      <code>word</code>
      <div contenteditable="true">word</div>
    `
    highlighter.update(DEFAULT_CONFIG.selectionToolbar.wordHighlight, [entry("word")])
    highlighter.start()

    expect(document.querySelectorAll(`[${WORD_HIGHLIGHT_ATTRIBUTE}]`)).toHaveLength(2)
    expect(
      document.querySelector("button")?.querySelector(`[${WORD_HIGHLIGHT_ATTRIBUTE}]`),
    ).toBeNull()
    expect(
      document.querySelector("code")?.querySelector(`[${WORD_HIGHLIGHT_ATTRIBUTE}]`),
    ).toBeNull()
    expect(
      document.querySelector("[contenteditable]")?.querySelector(`[${WORD_HIGHLIGHT_ATTRIBUTE}]`),
    ).toBeNull()
  })

  it("dispatches a quick Dictionary lookup when a highlighted word is clicked", () => {
    document.body.innerHTML = "<p>Look up serendipity in this sentence.</p>"
    highlighter.update(DEFAULT_CONFIG.selectionToolbar.wordHighlight, [entry("serendipity")])
    highlighter.start()
    const listener = vi.fn<(event: Event) => void>()
    window.addEventListener(WORD_HIGHLIGHT_LOOKUP_EVENT, listener)

    const highlightedWord = document.querySelector(`[${WORD_HIGHLIGHT_ATTRIBUTE}]`)!
    fireEvent.click(highlightedWord, { ctrlKey: true })
    expect(listener).not.toHaveBeenCalled()

    fireEvent.click(highlightedWord)

    expect(listener).toHaveBeenCalledOnce()
    const detail = (listener.mock.calls[0]![0] as CustomEvent<WordHighlightLookupDetail>).detail
    expect(detail).toMatchObject({
      term: "serendipity",
      context: "Look up serendipity in this sentence.",
    })
    window.removeEventListener(WORD_HIGHLIGHT_LOOKUP_EVENT, listener)
  })

  it("highlights dynamically inserted content without rescanning existing highlights", async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const suspendedAnimationFrame = vi.fn<(callback: FrameRequestCallback) => number>(() => 1)
    window.requestAnimationFrame = suspendedAnimationFrame
    document.body.innerHTML = "<p>Existing vocabulary</p>"
    highlighter.update(DEFAULT_CONFIG.selectionToolbar.wordHighlight, [entry("vocabulary")])
    highlighter.start()

    try {
      const paragraph = document.createElement("p")
      paragraph.textContent = "Dynamic vocabulary"
      document.body.append(paragraph)

      await waitFor(() => {
        expect(document.querySelectorAll(`[${WORD_HIGHLIGHT_ATTRIBUTE}]`)).toHaveLength(2)
      })
      expect(suspendedAnimationFrame).not.toHaveBeenCalled()
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame
    }
  })

  it("unwraps highlights and removes injected styles when disabled", () => {
    document.body.innerHTML = "<p>saved word</p>"
    highlighter.update(DEFAULT_CONFIG.selectionToolbar.wordHighlight, [entry("word")])
    highlighter.start()
    expect(document.querySelector(`[${WORD_HIGHLIGHT_ATTRIBUTE}]`)).not.toBeNull()

    highlighter.update({ ...DEFAULT_CONFIG.selectionToolbar.wordHighlight, enabled: false }, [
      entry("word"),
    ])

    expect(document.querySelector(`[${WORD_HIGHLIGHT_ATTRIBUTE}]`)).toBeNull()
    expect(document.querySelector("[data-read-frog-word-highlight-style]")).toBeNull()
    expect(document.querySelector("p")?.textContent).toBe("saved word")
  })
})
