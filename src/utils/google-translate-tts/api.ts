import type {
  GoogleTranslateTTSSynthesizeRequest,
  GoogleTranslateTTSSynthesizeResponse,
} from "@/types/google-translate-tts"
import { GOOGLE_TRANSLATE_TTS_SPEED_VALUES } from "@/types/google-translate-tts"
import {
  GOOGLE_TRANSLATE_TTS_CLIENT,
  GOOGLE_TRANSLATE_TTS_MAX_CHARS,
  GOOGLE_TRANSLATE_TTS_SPEED_QUERY_VALUE,
  GOOGLE_TRANSLATE_TTS_TIMEOUT_MS,
  GOOGLE_TRANSLATE_TTS_URL,
} from "./constants"
import { GoogleTranslateTTSError, toGoogleTranslateTTSErrorPayload } from "./errors"

const GOOGLE_TRANSLATE_TTS_LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i

export function buildGoogleTranslateTTSUrl({
  text,
  language,
  speed,
}: GoogleTranslateTTSSynthesizeRequest): string {
  const url = new URL(GOOGLE_TRANSLATE_TTS_URL)
  url.search = new URLSearchParams({
    ie: "UTF-8",
    client: GOOGLE_TRANSLATE_TTS_CLIENT,
    tl: language,
    ttsspeed: GOOGLE_TRANSLATE_TTS_SPEED_QUERY_VALUE[speed],
    q: text,
  }).toString()
  return url.toString()
}

function validateRequest(request: GoogleTranslateTTSSynthesizeRequest): void {
  if (!request.text.trim()) {
    throw new GoogleTranslateTTSError("INVALID_TEXT", "Google Translate TTS input is empty")
  }

  if (request.text.length > GOOGLE_TRANSLATE_TTS_MAX_CHARS) {
    throw new GoogleTranslateTTSError(
      "TEXT_TOO_LONG",
      `Google Translate TTS accepts at most ${GOOGLE_TRANSLATE_TTS_MAX_CHARS} characters per request`,
    )
  }

  if (!GOOGLE_TRANSLATE_TTS_LANGUAGE_PATTERN.test(request.language)) {
    throw new GoogleTranslateTTSError(
      "INVALID_LANGUAGE",
      `Invalid Google Translate TTS language code: ${request.language}`,
    )
  }

  if (!GOOGLE_TRANSLATE_TTS_SPEED_VALUES.includes(request.speed)) {
    throw new GoogleTranslateTTSError(
      "INVALID_SPEED",
      `Invalid Google Translate TTS speed: ${request.speed}`,
    )
  }
}

async function synthesize(
  request: GoogleTranslateTTSSynthesizeRequest,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  validateRequest(request)

  let response: Response
  try {
    response = await fetch(buildGoogleTranslateTTSUrl(request), {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      headers: {
        Accept: "audio/mpeg",
      },
      signal: AbortSignal.timeout(GOOGLE_TRANSLATE_TTS_TIMEOUT_MS),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new GoogleTranslateTTSError(
      "NETWORK_ERROR",
      `Network error while requesting Google Translate TTS: ${message}`,
      { retryable: true, cause: error },
    )
  }

  if (!response.ok) {
    if (response.status === 400) {
      throw new GoogleTranslateTTSError(
        "UNSUPPORTED_LANGUAGE",
        `Google Translate cannot generate speech for language "${request.language}" or the supplied text`,
        { status: response.status },
      )
    }

    if (response.status === 429) {
      throw new GoogleTranslateTTSError(
        "SYNTH_RATE_LIMITED",
        "Google Translate TTS rate limit reached",
        { status: response.status, retryable: true },
      )
    }

    if (response.status >= 500) {
      throw new GoogleTranslateTTSError(
        "SYNTH_SERVER_ERROR",
        `Google Translate TTS server error: ${response.status}`,
        { status: response.status, retryable: true },
      )
    }

    throw new GoogleTranslateTTSError(
      "SYNTH_REQUEST_FAILED",
      `Google Translate TTS request failed: ${response.status}`,
      { status: response.status },
    )
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg"
  if (!contentType.startsWith("audio/")) {
    throw new GoogleTranslateTTSError(
      "SYNTH_REQUEST_FAILED",
      `Google Translate TTS returned an unexpected content type: ${contentType}`,
    )
  }

  const audio = await response.arrayBuffer()
  if (audio.byteLength === 0) {
    throw new GoogleTranslateTTSError("EMPTY_AUDIO", "Google Translate TTS returned empty audio")
  }

  return { audio, contentType }
}

export async function synthesizeGoogleTranslateTTS(
  request: GoogleTranslateTTSSynthesizeRequest,
): Promise<GoogleTranslateTTSSynthesizeResponse> {
  try {
    const result = await synthesize(request)
    return {
      ok: true,
      ...result,
    }
  } catch (error) {
    return {
      ok: false,
      error: toGoogleTranslateTTSErrorPayload(error),
    }
  }
}
