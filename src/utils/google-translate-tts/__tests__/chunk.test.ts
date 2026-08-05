import { describe, expect, it } from "vitest"
import { splitGoogleTranslateTTSText } from "../chunk"

describe("splitGoogleTranslateTTSText", () => {
  it("keeps every request within Google Translate's 200-character limit", () => {
    const chunks = splitGoogleTranslateTTSText("hello world. ".repeat(80))

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 200)).toBe(true)
  })

  it("prefers sentence or whitespace boundaries", () => {
    const chunks = splitGoogleTranslateTTSText("one two three four five six", 14, 10)

    expect(chunks[0]).toBe("one two three")
    expect(chunks.join(" ")).toBe("one two three four five six")
  })

  it("does not split a surrogate pair", () => {
    const chunks = splitGoogleTranslateTTSText("a🙂b", 2, 10)

    expect(chunks).toEqual(["a", "🙂", "b"])
    expect(chunks.join("")).toBe("a🙂b")
  })

  it("rejects empty and excessively long input", () => {
    expect(() => splitGoogleTranslateTTSText("  ")).toThrow(/empty/i)
    expect(() => splitGoogleTranslateTTSText("a ".repeat(100), 5, 2)).toThrow(/too long/i)
  })
})
