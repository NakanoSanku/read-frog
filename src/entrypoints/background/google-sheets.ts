import type {
  SaveGoogleSheetsRowsRequest,
  SaveGoogleSheetsRowsResponse,
} from "@/types/google-sheets"
import {
  getGoogleUserInfo,
  getValidAccessToken,
  GOOGLE_SHEETS_SCOPE,
} from "@/utils/google-drive/auth"
import {
  appendGoogleSheetRows,
  buildGoogleSheetRows,
  createGoogleSheetsConnectedAccountSnapshot,
  getGoogleSheetSchema,
  getGoogleSpreadsheetUrl,
  GoogleSheetsApiError,
  isSameGoogleSheetsAccount,
  sanitizeCustomActionGoogleSheetsConnection,
} from "@/utils/google-sheets"
import { onMessage } from "@/utils/message"

export async function saveRowsToGoogleSheets(
  request: SaveGoogleSheetsRowsRequest,
): Promise<SaveGoogleSheetsRowsResponse> {
  const { action, results } = request
  const connection = sanitizeCustomActionGoogleSheetsConnection(
    action.googleSheetsConnection,
    action.outputSchema,
  )
  if (!connection || results.length === 0) {
    return { ok: false, reason: "not_configured" }
  }

  try {
    const accessToken = await getValidAccessToken([GOOGLE_SHEETS_SCOPE])
    const currentAccount = createGoogleSheetsConnectedAccountSnapshot(
      await getGoogleUserInfo(accessToken),
    )
    if (!currentAccount) {
      return { ok: false, reason: "authentication_failed" }
    }
    if (!isSameGoogleSheetsAccount(connection.connectedAccount, currentAccount)) {
      return { ok: false, reason: "account_mismatch" }
    }

    const schema = await getGoogleSheetSchema(connection.spreadsheetId, connection.sheetId)
    const refreshedConnection = {
      ...connection,
      spreadsheetNameSnapshot: schema.title,
      sheetNameSnapshot: schema.sheetTitle,
      connectedAccount: currentAccount,
    }
    const actionWithRefreshedConnection = {
      ...action,
      googleSheetsConnection: refreshedConnection,
    }
    const { rows, validation } = buildGoogleSheetRows(
      actionWithRefreshedConnection,
      schema,
      results,
    )
    if (validation.kind !== "valid") {
      return { ok: false, reason: "mapping_invalid" }
    }

    await appendGoogleSheetRows(schema, rows)
    return {
      ok: true,
      connection: refreshedConnection,
      spreadsheetName: schema.title,
      sheetName: schema.sheetTitle,
      url: getGoogleSpreadsheetUrl(schema.spreadsheetId, schema.sheetId),
    }
  } catch (error) {
    if (error instanceof GoogleSheetsApiError) {
      return { ok: false, reason: error.reason, message: error.message }
    }

    return {
      ok: false,
      reason: "request_failed",
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

export function setupGoogleSheetsMessageHandlers() {
  onMessage("saveGoogleSheetsRows", (message) => saveRowsToGoogleSheets(message.data))
}
