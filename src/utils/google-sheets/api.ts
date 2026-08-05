import { z } from "zod"
import {
  clearAccessToken,
  getValidAccessToken,
  GOOGLE_SHEETS_SCOPE,
} from "@/utils/google-drive/auth"

const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets"

const googleSheetsValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const googleSpreadsheetResponseSchema = z.object({
  spreadsheetId: z.string(),
  properties: z.object({
    title: z.string(),
  }),
  spreadsheetUrl: z.url().optional(),
  sheets: z.array(
    z.object({
      properties: z.object({
        sheetId: z.number().int().nonnegative(),
        title: z.string(),
        sheetType: z.string().optional(),
      }),
    }),
  ),
})

const googleSheetValuesResponseSchema = z.object({
  values: z.array(z.array(googleSheetsValueSchema)).optional(),
})

const googleSheetsAppendResponseSchema = z.object({
  spreadsheetId: z.string(),
})

const googleApiErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
  }),
})

export type GoogleSheetsApiErrorReason =
  | "authentication_failed"
  | "access_denied"
  | "spreadsheet_unavailable"
  | "sheet_unavailable"
  | "invalid_response"
  | "request_failed"

export class GoogleSheetsApiError extends Error {
  constructor(
    public readonly reason: GoogleSheetsApiErrorReason,
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = "GoogleSheetsApiError"
  }
}

export interface GoogleSheetColumn {
  columnIndex: number
  name: string
}

export interface GoogleSheetSummary {
  sheetId: number
  title: string
}

export interface GoogleSpreadsheetSummary {
  spreadsheetId: string
  title: string
  url: string
  sheets: GoogleSheetSummary[]
}

export interface GoogleSheetSchema extends GoogleSpreadsheetSummary {
  sheetId: number
  sheetTitle: string
  columns: GoogleSheetColumn[]
}

export interface GoogleSheetsReference {
  spreadsheetId: string
  sheetId?: number
}

function getGoogleApiErrorMessage(data: unknown, fallback: string) {
  const parsed = googleApiErrorSchema.safeParse(data)
  return parsed.success ? (parsed.data.error.message ?? fallback) : fallback
}

async function requestGoogleSheets<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const accessToken = await getValidAccessToken([GOOGLE_SHEETS_SCOPE])
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${accessToken}`)
  const response = await fetch(url, {
    ...init,
    headers,
  })

  if (!response.ok) {
    if (response.status === 401) {
      await clearAccessToken()
    }

    const errorData = await response.json().catch(() => null)
    const message = getGoogleApiErrorMessage(
      errorData,
      `Google Sheets request failed with status ${response.status}`,
    )
    const reason: GoogleSheetsApiErrorReason =
      response.status === 401
        ? "authentication_failed"
        : response.status === 403
          ? "access_denied"
          : response.status === 404
            ? "spreadsheet_unavailable"
            : "request_failed"

    throw new GoogleSheetsApiError(reason, message, response.status)
  }

  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) {
    throw new GoogleSheetsApiError(
      "invalid_response",
      `Invalid response from Google Sheets API: ${parsed.error.message}`,
    )
  }

  return parsed.data
}

export function parseGoogleSheetsReference(value: string): GoogleSheetsReference | null {
  const input = value.trim()
  if (!input) {
    return null
  }

  if (/^[A-Za-z0-9_-]+$/.test(input)) {
    return { spreadsheetId: input }
  }

  try {
    const url = new URL(input)
    const match = url.pathname.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)
    if (!match?.[1]) {
      return null
    }

    const rawSheetId =
      url.searchParams.get("gid") ?? new URLSearchParams(url.hash.slice(1)).get("gid")
    const sheetId = rawSheetId === null ? undefined : Number(rawSheetId)

    return {
      spreadsheetId: match[1],
      ...(typeof sheetId === "number" && Number.isInteger(sheetId) && sheetId >= 0
        ? { sheetId }
        : {}),
    }
  } catch {
    return null
  }
}

export function getGoogleSpreadsheetUrl(spreadsheetId: string, sheetId?: number) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`)
  if (sheetId !== undefined) {
    url.hash = `gid=${sheetId}`
  }
  return url.toString()
}

export function quoteGoogleSheetTitle(title: string) {
  return `'${title.replaceAll("'", "''")}'`
}

export function columnIndexToA1(columnIndex: number) {
  if (!Number.isInteger(columnIndex) || columnIndex < 0) {
    throw new RangeError("Google Sheets column index must be a non-negative integer")
  }

  let value = columnIndex + 1
  let result = ""
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

export async function getGoogleSpreadsheet(
  spreadsheetId: string,
): Promise<GoogleSpreadsheetSummary> {
  const url = new URL(`${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}`)
  url.searchParams.set(
    "fields",
    "spreadsheetId,properties(title),spreadsheetUrl,sheets(properties(sheetId,title,sheetType))",
  )

  const data = await requestGoogleSheets(url.toString(), googleSpreadsheetResponseSchema)
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties.title,
    url: data.spreadsheetUrl ?? getGoogleSpreadsheetUrl(data.spreadsheetId),
    sheets: data.sheets
      .filter((sheet) => !sheet.properties.sheetType || sheet.properties.sheetType === "GRID")
      .map((sheet) => ({
        sheetId: sheet.properties.sheetId,
        title: sheet.properties.title,
      })),
  }
}

async function getGoogleSheetColumns(spreadsheetId: string, sheetTitle: string) {
  const range = `${quoteGoogleSheetTitle(sheetTitle)}!1:1`
  const url = new URL(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
  )
  url.searchParams.set("majorDimension", "ROWS")
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE")

  const data = await requestGoogleSheets(url.toString(), googleSheetValuesResponseSchema)
  const headerRow = data.values?.[0] ?? []

  return headerRow.flatMap((value, columnIndex): GoogleSheetColumn[] => {
    const name = value === null ? "" : String(value).trim()
    return name ? [{ columnIndex, name }] : []
  })
}

export async function getGoogleSheetSchema(
  spreadsheetId: string,
  sheetId: number,
): Promise<GoogleSheetSchema> {
  const spreadsheet = await getGoogleSpreadsheet(spreadsheetId)
  const sheet = spreadsheet.sheets.find((item) => item.sheetId === sheetId)
  if (!sheet) {
    throw new GoogleSheetsApiError(
      "sheet_unavailable",
      `Google Sheet tab ${sheetId} is unavailable`,
    )
  }

  const columns = await getGoogleSheetColumns(spreadsheetId, sheet.title)
  return {
    ...spreadsheet,
    sheetId: sheet.sheetId,
    sheetTitle: sheet.title,
    columns,
  }
}

export async function appendGoogleSheetRows(
  schema: GoogleSheetSchema,
  rows: Array<Array<string | number>>,
) {
  if (rows.length === 0) {
    return
  }

  const widestRow = Math.max(...rows.map((row) => row.length))
  if (widestRow === 0) {
    throw new GoogleSheetsApiError("request_failed", "Cannot append an empty Google Sheets row")
  }

  const range = `${quoteGoogleSheetTitle(schema.sheetTitle)}!A:${columnIndexToA1(widestRow - 1)}`
  const url = new URL(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(schema.spreadsheetId)}/values/${encodeURIComponent(range)}:append`,
  )
  url.searchParams.set("valueInputOption", "RAW")
  url.searchParams.set("insertDataOption", "INSERT_ROWS")

  await requestGoogleSheets(url.toString(), googleSheetsAppendResponseSchema, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      majorDimension: "ROWS",
      values: rows,
    }),
  })
}
