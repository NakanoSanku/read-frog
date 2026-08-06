import type { SavedVocabularyEntry } from "@/types/vocabulary"
import { describe, expect, it } from "vitest"
import { createVocabularyMatcher } from "../matcher"
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

function highlightedTerms(text: string, terms: string[]) {
  return createVocabularyMatcher(terms.map(entry))
    .split(text)
    .filter((segment) => segment.entry)
    .map((segment) => segment.text)
}

describe("vocabulary matcher", () => {
  it("matches case-insensitively and allows flexible whitespace in phrases", () => {
    expect(highlightedTerms("A NEW   word appeared.", ["new word"])).toEqual(["NEW   word"])
  })

  it("prefers the longest saved phrase", () => {
    expect(highlightedTerms("The plane will take off now.", ["take", "take off"])).toEqual([
      "take off",
    ])
  })

  it("uses word boundaries for space-delimited languages", () => {
    expect(highlightedTerms("art artist partial art", ["art"])).toEqual(["art", "art"])
  })

  it("matches terms inside continuous CJK text", () => {
    expect(highlightedTerms("我正在学习中文词汇", ["中文", "词汇"])).toEqual(["中文", "词汇"])
  })

  it("returns a single plain segment when there are no saved terms", () => {
    expect(createVocabularyMatcher([]).split("plain text")).toEqual([{ text: "plain text" }])
  })
})
