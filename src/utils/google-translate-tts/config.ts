import type { LangCodeISO6393 } from "@read-frog/definitions"
import { ISO6393_TO_6391 } from "@read-frog/definitions"

const GOOGLE_TRANSLATE_LANGUAGE_OVERRIDES: Partial<Record<LangCodeISO6393, string>> = {
  cmn: "zh-CN",
  "cmn-Hant": "zh-TW",
  yue: "yue",
}

function getLanguageFromEdgeVoice(voice: string): string | null {
  const parts = voice.trim().split("-")
  const baseLanguage = parts[0]?.toLowerCase()
  if (!baseLanguage || !/^[a-z]{2,3}$/.test(baseLanguage)) {
    return null
  }

  if (baseLanguage === "zh") {
    return parts[1]?.toUpperCase() === "TW" ? "zh-TW" : "zh-CN"
  }

  if (baseLanguage === "yue") {
    return "yue"
  }

  // Edge uses the modern BCP 47 code while Google Translate also accepts
  // its long-standing Translate code for Filipino.
  if (baseLanguage === "fil") {
    return "tl"
  }

  return baseLanguage
}

export function getGoogleTranslateTTSLanguage(
  detectedLanguage: LangCodeISO6393 | null | undefined,
  fallbackVoice: string,
): string {
  if (detectedLanguage) {
    const language =
      GOOGLE_TRANSLATE_LANGUAGE_OVERRIDES[detectedLanguage] ?? ISO6393_TO_6391[detectedLanguage]
    if (language) {
      return language
    }
  }

  return getLanguageFromEdgeVoice(fallbackVoice) ?? "en"
}
