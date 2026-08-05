import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/utils/google-drive/auth", () => ({
  clearAccessToken: vi.fn<() => Promise<void>>(),
  getGoogleUserInfo: vi.fn<(accessToken: string) => Promise<unknown>>(),
  getValidAccessToken: vi.fn<(requiredScopes?: readonly string[]) => Promise<string>>(),
  GOOGLE_SHEETS_SCOPE: "https://www.googleapis.com/auth/spreadsheets",
}))

vi.mock("@/utils/message", () => ({
  onMessage: vi.fn<() => void>(),
}))

import { getGoogleUserInfo, getValidAccessToken } from "@/utils/google-drive/auth"
import { saveRowsToGoogleSheets } from "../google-sheets"

function createAction(): SelectionToolbarCustomAction {
  return {
    id: "action-1",
    name: "Summarize",
    icon: "tabler:sparkles",
    providerId: "provider-1",
    systemPrompt: "system",
    prompt: "prompt",
    outputSchema: [
      {
        id: "field-summary",
        name: "summary",
        type: "string",
        description: "",
        speaking: false,
      },
    ],
    googleSheetsConnection: {
      spreadsheetId: "spreadsheet-id",
      spreadsheetNameSnapshot: "Reading notes",
      sheetId: 7,
      sheetNameSnapshot: "Notes",
      connectedAccount: {
        id: "account-1",
        email: "reader@example.com",
        image: null,
      },
      mappings: [
        {
          id: "mapping-summary",
          localFieldId: "field-summary",
          columnIndex: 0,
          columnNameSnapshot: "Summary",
        },
      ],
    },
  }
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function mockSchemaRequests(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, header: string) {
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        spreadsheetId: "spreadsheet-id",
        properties: { title: "Reading notes" },
        sheets: [{ properties: { sheetId: 7, title: "Notes", sheetType: "GRID" } }],
      }),
    )
    .mockResolvedValueOnce(jsonResponse({ values: [[header]] }))
}

describe("Google Sheets background save", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getValidAccessToken).mockResolvedValue("access-token")
    vi.mocked(getGoogleUserInfo).mockResolvedValue({
      id: "account-1",
      email: "reader@example.com",
      verified_email: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("revalidates the account and headers before appending rows", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    mockSchemaRequests(fetchMock, "Summary")
    fetchMock.mockResolvedValueOnce(jsonResponse({ spreadsheetId: "spreadsheet-id" }))
    vi.stubGlobal("fetch", fetchMock)

    const response = await saveRowsToGoogleSheets({
      action: createAction(),
      results: [{ summary: "A useful idea" }],
    })

    expect(response).toMatchObject({
      ok: true,
      spreadsheetName: "Reading notes",
      sheetName: "Notes",
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const appendRequest = fetchMock.mock.calls[2]?.[1]
    expect(JSON.parse(appendRequest?.body as string)).toEqual({
      majorDimension: "ROWS",
      values: [["A useful idea"]],
    })
  })

  it("blocks a save made from a different Google account", async () => {
    vi.mocked(getGoogleUserInfo).mockResolvedValue({
      id: "account-2",
      email: "other@example.com",
      verified_email: true,
    })
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)

    const response = await saveRowsToGoogleSheets({
      action: createAction(),
      results: [{ summary: "A useful idea" }],
    })

    expect(response).toEqual({ ok: false, reason: "account_mismatch" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("blocks a save when the mapped header changed", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    mockSchemaRequests(fetchMock, "Renamed summary")
    vi.stubGlobal("fetch", fetchMock)

    const response = await saveRowsToGoogleSheets({
      action: createAction(),
      results: [{ summary: "A useful idea" }],
    })

    expect(response).toEqual({ ok: false, reason: "mapping_invalid" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
