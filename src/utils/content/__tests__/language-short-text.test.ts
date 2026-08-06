import type { LangCodeISO6393 } from "@read-frog/definitions"
import { describe, expect, it } from "vitest"
import { detectLanguageWithSource } from "../language"

describe("short-text language detection", () => {
  it.each<[string, LangCodeISO6393]>([
    ["你好", "cmn"],
    ["こんにちは", "jpn"],
    ["Привет", "rus"],
    ["สวัสดี", "tha"],
  ])("detects %s when callers disable the minimum length", async (text, code) => {
    await expect(detectLanguageWithSource(text, { minLength: 0 })).resolves.toEqual({
      code,
      source: "franc",
    })
  })
})
