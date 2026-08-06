import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getRedirectURL: vi.fn<() => string>(() => "https://extension-id.chromiumapp.org/"),
}))

vi.mock("#imports", () => ({
  browser: {
    identity: {
      getRedirectURL: mocks.getRedirectURL,
      launchWebAuthFlow:
        vi.fn<(details: { url: string; interactive: boolean }) => Promise<string | undefined>>(),
    },
  },
  storage: {},
}))

vi.mock("@/env", () => ({
  env: { WXT_GOOGLE_CLIENT_ID: "google-client-id" },
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn<(message: string, error?: unknown) => void>(),
    warn: vi.fn<(message: string, error?: unknown) => void>(),
  },
}))

describe("Google OAuth module loading", () => {
  it("does not access the extension identity API during module evaluation", async () => {
    await import("../auth")

    expect(mocks.getRedirectURL).not.toHaveBeenCalled()
  })
})
