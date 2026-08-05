import { GOOGLE_TRANSLATE_TTS_MAX_CHARS, GOOGLE_TRANSLATE_TTS_MAX_CHUNKS } from "./constants"

const SOFT_BOUNDARY_CHARS = /[\s。！？；.!?؛۔]/

function alignToCodePointBoundary(text: string, index: number): number {
  if (index <= 0 || index >= text.length) {
    return index
  }

  const previousCode = text.charCodeAt(index - 1)
  const currentCode = text.charCodeAt(index)
  const splitsSurrogatePair =
    previousCode >= 0xd800 &&
    previousCode <= 0xdbff &&
    currentCode >= 0xdc00 &&
    currentCode <= 0xdfff

  return splitsSurrogatePair ? index - 1 : index
}

function adjustBySoftBoundary(text: string, candidate: number): number {
  if (candidate >= text.length) {
    return candidate
  }

  const floor = Math.max(1, Math.floor(candidate * 0.6))
  for (let index = candidate; index >= floor; index -= 1) {
    const character = text[index - 1]
    if (character && SOFT_BOUNDARY_CHARS.test(character)) {
      return index
    }
  }

  return candidate
}

export function splitGoogleTranslateTTSText(
  text: string,
  maxChars = GOOGLE_TRANSLATE_TTS_MAX_CHARS,
  maxChunks = GOOGLE_TRANSLATE_TTS_MAX_CHUNKS,
): string[] {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error("Google Translate TTS input is empty")
  }
  if (
    !Number.isInteger(maxChars) ||
    maxChars <= 0 ||
    !Number.isInteger(maxChunks) ||
    maxChunks <= 0
  ) {
    throw new Error("Google Translate TTS chunk limits must be positive integers")
  }

  const chunks: string[] = []
  let remaining = trimmed

  while (remaining.length > 0) {
    let splitAt = alignToCodePointBoundary(remaining, Math.min(maxChars, remaining.length))
    splitAt = adjustBySoftBoundary(remaining, splitAt)

    if (splitAt <= 0) {
      throw new Error("Unable to split Google Translate TTS input safely")
    }

    const chunk = remaining.slice(0, splitAt).trim()
    if (!chunk) {
      throw new Error("Encountered an empty Google Translate TTS chunk")
    }

    chunks.push(chunk)
    if (chunks.length > maxChunks) {
      throw new Error(
        `Text is too long for Google Translate TTS (max ${maxChunks} chunks at ${maxChars} characters each)`,
      )
    }

    remaining = remaining.slice(splitAt).trim()
  }

  return chunks
}
