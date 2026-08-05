import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/utils/google-drive/auth", () => ({
  clearAccessToken: vi.fn<() => Promise<void>>(),
  getValidAccessToken: vi
    .fn<(requiredScopes?: readonly string[]) => Promise<string>>()
    .mockResolvedValue("access-token"),
  GOOGLE_SHEETS_SCOPE: "https://www.googleapis.com/auth/spreadsheets",
}))

import {
  appendGoogleSheetRows,
  columnIndexToA1,
  parseGoogleSheetsReference,
  quoteGoogleSheetTitle,
} from "../api"

describe("Google Sheets API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("parses spreadsheet ids and Google Sheets links with a tab id", () => {
    expect(parseGoogleSheetsReference(" spreadsheet-id_123 ")).toEqual({
      spreadsheetId: "spreadsheet-id_123",
    })
    expect(
      parseGoogleSheetsReference(
        "https://docs.google.com/spreadsheets/d/spreadsheet-id_123/edit#gid=987",
      ),
    ).toEqual({ spreadsheetId: "spreadsheet-id_123", sheetId: 987 })
    expect(
      parseGoogleSheetsReference(
        "https://docs.google.com/spreadsheets/d/spreadsheet-id_123/edit?gid=42",
      ),
    ).toEqual({ spreadsheetId: "spreadsheet-id_123", sheetId: 42 })
    expect(parseGoogleSheetsReference("https://docs.google.com/document/d/not-a-sheet")).toBeNull()
  })

  it("quotes worksheet titles and converts zero-based columns to A1 notation", () => {
    expect(quoteGoogleSheetTitle("Team's notes")).toBe("'Team''s notes'")
    expect([0, 25, 26, 51, 52, 702].map(columnIndexToA1)).toEqual([
      "A",
      "Z",
      "AA",
      "AZ",
      "BA",
      "AAA",
    ])
    expect(() => columnIndexToA1(-1)).toThrow(RangeError)
  })

  it("appends rows with the required scope token and the widest mapped column", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ spreadsheetId: "spreadsheet-id_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await appendGoogleSheetRows(
      {
        spreadsheetId: "spreadsheet-id_123",
        title: "Notes",
        url: "https://docs.google.com/spreadsheets/d/spreadsheet-id_123/edit",
        sheets: [{ sheetId: 0, title: "Team's notes" }],
        sheetId: 0,
        sheetTitle: "Team's notes",
        columns: [],
      },
      [["Summary", ...Array.from({ length: 26 }, () => ""), 9]],
    )

    const [requestUrl, requestInit] = fetchMock.mock.calls[0]!
    const url = new URL(
      typeof requestUrl === "string"
        ? requestUrl
        : requestUrl instanceof URL
          ? requestUrl.href
          : requestUrl.url,
    )
    expect(decodeURIComponent(url.pathname).endsWith("/values/'Team''s notes'!A:AB:append")).toBe(
      true,
    )
    expect(url.searchParams.get("valueInputOption")).toBe("RAW")
    expect(url.searchParams.get("insertDataOption")).toBe("INSERT_ROWS")
    expect(requestInit?.method).toBe("POST")
    expect(new Headers(requestInit?.headers).get("Authorization")).toBe("Bearer access-token")
  })
})
