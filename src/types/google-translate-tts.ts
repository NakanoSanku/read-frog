export const GOOGLE_TRANSLATE_TTS_SPEED_VALUES = ["normal", "slow", "slower"] as const

export type GoogleTranslateTTSSpeed = (typeof GOOGLE_TRANSLATE_TTS_SPEED_VALUES)[number]

export const GOOGLE_TRANSLATE_TTS_ERROR_CODES = [
  "INVALID_TEXT",
  "TEXT_TOO_LONG",
  "INVALID_LANGUAGE",
  "INVALID_SPEED",
  "UNSUPPORTED_LANGUAGE",
  "SYNTH_RATE_LIMITED",
  "SYNTH_SERVER_ERROR",
  "SYNTH_REQUEST_FAILED",
  "EMPTY_AUDIO",
  "NETWORK_ERROR",
  "UNKNOWN_ERROR",
] as const

export type GoogleTranslateTTSErrorCode = (typeof GOOGLE_TRANSLATE_TTS_ERROR_CODES)[number]

export interface GoogleTranslateTTSErrorPayload {
  code: GoogleTranslateTTSErrorCode
  message: string
  retryable?: boolean
  status?: number
}

export interface GoogleTranslateTTSSynthesizeRequest {
  text: string
  language: string
  speed: GoogleTranslateTTSSpeed
}

export interface GoogleTranslateTTSSynthesizeSuccess {
  ok: true
  audio: ArrayBuffer
  contentType: string
}

export interface GoogleTranslateTTSSynthesizeFailure {
  ok: false
  error: GoogleTranslateTTSErrorPayload
}

export type GoogleTranslateTTSSynthesizeResponse =
  | GoogleTranslateTTSSynthesizeSuccess
  | GoogleTranslateTTSSynthesizeFailure

export interface GoogleTranslateTTSSynthesizeWireSuccess {
  ok: true
  audioBase64: string
  contentType: string
}

export type GoogleTranslateTTSSynthesizeWireResponse =
  | GoogleTranslateTTSSynthesizeWireSuccess
  | GoogleTranslateTTSSynthesizeFailure
