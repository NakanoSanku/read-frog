import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionGoogleSheetsConnection,
} from "@/types/config/selection-toolbar"
import type { GoogleSheetsApiErrorReason } from "@/utils/google-sheets/api"

export interface SaveGoogleSheetsRowsRequest {
  action: SelectionToolbarCustomAction
  results: Array<Record<string, unknown>>
}

export type SaveGoogleSheetsRowsFailureReason =
  | GoogleSheetsApiErrorReason
  | "not_configured"
  | "account_mismatch"
  | "mapping_invalid"

export type SaveGoogleSheetsRowsResponse =
  | {
      ok: true
      connection: SelectionToolbarCustomActionGoogleSheetsConnection
      spreadsheetName: string
      sheetName: string
      url: string
    }
  | {
      ok: false
      reason: SaveGoogleSheetsRowsFailureReason
      message?: string
    }
