import { describe, expect, it } from "vitest"
import { getGoogleTranslateTTSLanguage } from "../config"

describe("getGoogleTranslateTTSLanguage", () => {
  it("maps detected ISO 639-3 languages to Google Translate codes", () => {
    expect(getGoogleTranslateTTSLanguage("eng", "ja-JP-KeitaNeural")).toBe("en")
    expect(getGoogleTranslateTTSLanguage("jpn", "en-US-DavisNeural")).toBe("ja")
  })

  it("preserves Chinese variants and Cantonese", () => {
    expect(getGoogleTranslateTTSLanguage("cmn", "en-US-DavisNeural")).toBe("zh-CN")
    expect(getGoogleTranslateTTSLanguage("cmn-Hant", "en-US-DavisNeural")).toBe("zh-TW")
    expect(getGoogleTranslateTTSLanguage("yue", "en-US-DavisNeural")).toBe("yue")
  })

  it("uses the selected Edge voice locale when detection is unavailable", () => {
    expect(getGoogleTranslateTTSLanguage(null, "zh-TW-YunJheNeural")).toBe("zh-TW")
    expect(getGoogleTranslateTTSLanguage(undefined, "fil-PH-AngeloNeural")).toBe("tl")
    expect(getGoogleTranslateTTSLanguage(null, "custom-voice")).toBe("en")
  })
})
