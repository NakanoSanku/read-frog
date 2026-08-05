import { synthesizeGoogleTranslateTTS } from "@/utils/google-translate-tts"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!)
  }
  return btoa(binary)
}

export function setupGoogleTranslateTTSMessageHandlers() {
  onMessage("googleTranslateTtsSynthesize", async (message) => {
    const response = await synthesizeGoogleTranslateTTS(message.data)
    if (!response.ok) {
      logger.warn("[Background][GoogleTranslateTTS] synthesize failed:", response.error)
      return response
    }

    return {
      ok: true as const,
      audioBase64: arrayBufferToBase64(response.audio),
      contentType: response.contentType,
    }
  })
}
