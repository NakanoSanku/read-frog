import { franc } from "franc"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { detectLanguageWithSource } from "../language"

vi.mock("franc", () => ({
  franc: vi.fn<(...args: any[]) => any>(),
}))

const mockFranc = vi.mocked(franc)

describe("detectLanguageWithSource", () => {
  beforeEach(() => {
    mockFranc.mockReset()
  })

  it("returns franc result when it is a supported language code", async () => {
    mockFranc.mockReturnValue("eng")

    await expect(
      detectLanguageWithSource("This is enough text to detect language."),
    ).resolves.toEqual({
      code: "eng",
      source: "franc",
    })
    expect(mockFranc).toHaveBeenCalledWith("This is enough text to detect language.", {
      minLength: 10,
    })
  })

  it("forwards a custom minimum length so short TTS text can be detected", async () => {
    mockFranc.mockReturnValue("cmn")

    await expect(detectLanguageWithSource("你好", { minLength: 0 })).resolves.toEqual({
      code: "cmn",
      source: "franc",
    })
    expect(mockFranc).toHaveBeenCalledWith("你好", { minLength: 0 })
  })

  it("falls back when franc returns an unsupported language code", async () => {
    mockFranc.mockReturnValue("vmw")

    await expect(
      detectLanguageWithSource("Eyi je oro ni ede Yoruba fun idanwo wiwa ede."),
    ).resolves.toEqual({
      code: "und",
      source: "fallback",
    })
  })
})
