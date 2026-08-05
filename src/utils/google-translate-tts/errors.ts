import type {
  GoogleTranslateTTSErrorCode,
  GoogleTranslateTTSErrorPayload,
} from "@/types/google-translate-tts"

export class GoogleTranslateTTSError extends Error {
  code: GoogleTranslateTTSErrorCode
  retryable: boolean
  status?: number

  constructor(
    code: GoogleTranslateTTSErrorCode,
    message: string,
    options?: {
      retryable?: boolean
      status?: number
      cause?: unknown
    },
  ) {
    super(message)
    this.name = "GoogleTranslateTTSError"
    this.code = code
    this.retryable = options?.retryable ?? false
    this.status = options?.status
    this.cause = options?.cause
  }
}

export function toGoogleTranslateTTSErrorPayload(error: unknown): GoogleTranslateTTSErrorPayload {
  if (error instanceof GoogleTranslateTTSError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      status: error.status,
    }
  }

  if (error instanceof Error) {
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
    }
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "Unknown Google Translate TTS error",
  }
}
