import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser, storage } from "#imports"

const mocks = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<unknown>>(),
  setItem: vi.fn<(key: string, value: unknown) => Promise<void>>(),
  removeItem: vi.fn<(key: string) => Promise<void>>(),
  launchWebAuthFlow:
    vi.fn<(details: { url: string; interactive: boolean }) => Promise<string | undefined>>(),
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

import { getIsAuthenticated, getValidAccessToken, GOOGLE_SHEETS_SCOPE } from "../auth"

describe("Google OAuth feature scopes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getItem = mocks.getItem
    storage.setItem = mocks.setItem
    storage.removeItem = mocks.removeItem
    browser.identity.launchWebAuthFlow =
      mocks.launchWebAuthFlow as typeof browser.identity.launchWebAuthFlow
    mocks.setItem.mockResolvedValue(undefined)
    mocks.removeItem.mockResolvedValue(undefined)
  })

  it("keeps legacy Drive authentication valid while requiring consent for Sheets", async () => {
    mocks.getItem.mockResolvedValue({
      access_token: "legacy-token",
      expires_at: Date.now() + 3_600_000,
      token_type: "Bearer",
    })

    await expect(getIsAuthenticated()).resolves.toBe(true)
    await expect(getIsAuthenticated([GOOGLE_SHEETS_SCOPE])).resolves.toBe(false)
  })

  it("requests and stores the Sheets scope when the existing token lacks it", async () => {
    mocks.getItem.mockResolvedValue({
      access_token: "drive-token",
      expires_at: Date.now() + 3_600_000,
      token_type: "Bearer",
      scopes: ["https://www.googleapis.com/auth/drive.appdata"],
    })
    const grantedScopes = [
      "https://www.googleapis.com/auth/drive.appdata",
      "https://www.googleapis.com/auth/userinfo.email",
      GOOGLE_SHEETS_SCOPE,
    ]
    mocks.launchWebAuthFlow.mockResolvedValue(
      `https://extension-id.chromiumapp.org/#access_token=sheets-token&expires_in=3600&scope=${encodeURIComponent(
        grantedScopes.join(" "),
      )}`,
    )

    await expect(getValidAccessToken([GOOGLE_SHEETS_SCOPE])).resolves.toBe("sheets-token")

    const authUrl = new URL(mocks.launchWebAuthFlow.mock.calls[0]![0].url)
    expect(authUrl.searchParams.get("include_granted_scopes")).toBe("true")
    expect(authUrl.searchParams.get("scope")?.split(" ")).toEqual(grantedScopes)
    expect(mocks.setItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        access_token: "sheets-token",
        scopes: grantedScopes,
      }),
    )
  })

  it("reuses a valid token that already includes the Sheets scope", async () => {
    mocks.getItem.mockResolvedValue({
      access_token: "sheets-token",
      expires_at: Date.now() + 3_600_000,
      token_type: "Bearer",
      scopes: [GOOGLE_SHEETS_SCOPE],
    })

    await expect(getValidAccessToken([GOOGLE_SHEETS_SCOPE])).resolves.toBe("sheets-token")
    expect(mocks.launchWebAuthFlow).not.toHaveBeenCalled()
  })
})
