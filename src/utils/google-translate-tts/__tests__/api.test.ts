import { afterEach, describe, expect, it, vi } from "vitest"
import { buildGoogleTranslateTTSUrl, synthesizeGoogleTranslateTTS } from "../api"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Google Translate TTS API", () => {
  it("builds the web speech request without double-encoding text", () => {
    const url = new URL(
      buildGoogleTranslateTTSUrl({
        text: "你好 & hello",
        language: "zh-CN",
        speed: "slow",
      }),
    )

    expect(url.origin + url.pathname).toBe("https://translate.googleapis.com/translate_tts")
    expect(url.searchParams.get("client")).toBe("gtx")
    expect(url.searchParams.get("tl")).toBe("zh-CN")
    expect(url.searchParams.get("ttsspeed")).toBe("0.24")
    expect(url.searchParams.get("q")).toBe("你好 & hello")
  })

  it("returns MPEG audio from a successful request", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await synthesizeGoogleTranslateTTS({
      text: "hello",
      language: "en",
      speed: "normal",
    })

    expect(result).toMatchObject({ ok: true, contentType: "audio/mpeg" })
    expect(result.ok ? result.audio.byteLength : 0).toBe(3)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("translate_tts"),
      expect.objectContaining({ credentials: "omit", cache: "no-store" }),
    )
  })

  it("reports unsupported languages and rate limits with stable codes", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      synthesizeGoogleTranslateTTS({ text: "hello", language: "ff", speed: "normal" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "UNSUPPORTED_LANGUAGE" } })
    await expect(
      synthesizeGoogleTranslateTTS({ text: "hello", language: "en", speed: "normal" }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "SYNTH_RATE_LIMITED", retryable: true },
    })
  })

  it("rejects oversized chunks before making a request", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      synthesizeGoogleTranslateTTS({
        text: "a".repeat(201),
        language: "en",
        speed: "normal",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "TEXT_TOO_LONG" } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects invalid speeds received across the runtime message boundary", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)

    const result = await synthesizeGoogleTranslateTTS({
      text: "hello",
      language: "en",
      // @ts-expect-error Deliberately exercises untyped data received at runtime.
      speed: "fast",
    })

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_SPEED" } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects non-audio and empty responses", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("blocked", { status: 200, headers: { "Content-Type": "text/html" } }),
      )
      .mockResolvedValueOnce(
        new Response(null, { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      synthesizeGoogleTranslateTTS({ text: "hello", language: "en", speed: "normal" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "SYNTH_REQUEST_FAILED" } })
    await expect(
      synthesizeGoogleTranslateTTS({ text: "hello", language: "en", speed: "normal" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "EMPTY_AUDIO" } })
  })
})
