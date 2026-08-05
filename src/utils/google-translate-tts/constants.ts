export const GOOGLE_TRANSLATE_TTS_URL = "https://translate.googleapis.com/translate_tts"
export const GOOGLE_TRANSLATE_TTS_CLIENT = "gtx"

// Exposed as `gMah5c` in the Google Translate web client configuration and
// independently enforced by the translate_tts endpoint.
export const GOOGLE_TRANSLATE_TTS_MAX_CHARS = 200
export const GOOGLE_TRANSLATE_TTS_MAX_CHUNKS = 60
export const GOOGLE_TRANSLATE_TTS_TIMEOUT_MS = 15_000

export const GOOGLE_TRANSLATE_TTS_SPEED_QUERY_VALUE = {
  normal: "1",
  slow: "0.24",
  slower: "0.1",
} as const
