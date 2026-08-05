import { beforeEach, describe, expect, it, vi } from "vitest"

const { onMessageMock, synthesizeMock, loggerWarnMock } = vi.hoisted(() => ({
  onMessageMock: vi.fn<(...args: any[]) => any>(),
  synthesizeMock: vi.fn<(...args: any[]) => any>(),
  loggerWarnMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
}))

vi.mock("@/utils/google-translate-tts", () => ({
  synthesizeGoogleTranslateTTS: synthesizeMock,
}))

vi.mock("@/utils/logger", () => ({
  logger: { warn: loggerWarnMock },
}))

import { setupGoogleTranslateTTSMessageHandlers } from "../google-translate-tts"

describe("Google Translate TTS background handler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns synthesized audio through the serializable wire format", async () => {
    synthesizeMock.mockResolvedValue({
      ok: true,
      audio: new Uint8Array([65, 66]).buffer,
      contentType: "audio/mpeg",
    })
    setupGoogleTranslateTTSMessageHandlers()

    const handler = onMessageMock.mock.calls.find(
      ([name]) => name === "googleTranslateTtsSynthesize",
    )?.[1]
    const request = { text: "hello", language: "en", speed: "normal" as const }

    await expect(handler({ data: request })).resolves.toEqual({
      ok: true,
      audioBase64: "QUI=",
      contentType: "audio/mpeg",
    })
    expect(synthesizeMock).toHaveBeenCalledWith(request)
  })

  it("passes typed synthesis failures through unchanged", async () => {
    const failure = {
      ok: false,
      error: { code: "UNSUPPORTED_LANGUAGE", message: "unsupported" },
    }
    synthesizeMock.mockResolvedValue(failure)
    setupGoogleTranslateTTSMessageHandlers()

    const handler = onMessageMock.mock.calls.find(
      ([name]) => name === "googleTranslateTtsSynthesize",
    )?.[1]

    await expect(
      handler({ data: { text: "hello", language: "ff", speed: "normal" } }),
    ).resolves.toEqual(failure)
  })
})
