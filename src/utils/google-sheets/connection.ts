import type {
  SelectionToolbarCustomActionGoogleSheetsAccount,
  SelectionToolbarCustomActionGoogleSheetsConnection,
  SelectionToolbarCustomActionOutputField,
} from "@/types/config/selection-toolbar"
import { selectionToolbarCustomActionGoogleSheetsAccountSchema } from "@/types/config/selection-toolbar"

export function createGoogleSheetsConnectedAccountSnapshot(
  account: unknown,
): SelectionToolbarCustomActionGoogleSheetsAccount | undefined {
  if (!account || typeof account !== "object") {
    return undefined
  }

  const value = account as Record<string, unknown>
  const parsedAccount = selectionToolbarCustomActionGoogleSheetsAccountSchema.safeParse({
    id: value.id,
    email: value.email,
    image: value.picture ?? value.image ?? null,
  })
  return parsedAccount.success ? parsedAccount.data : undefined
}

export function isSameGoogleSheetsAccount(
  storedAccount: SelectionToolbarCustomActionGoogleSheetsAccount | undefined,
  currentAccount: SelectionToolbarCustomActionGoogleSheetsAccount | undefined,
) {
  return !!storedAccount && !!currentAccount && storedAccount.id === currentAccount.id
}

export function formatGoogleSheetsConnectedAccountLabel(
  account: SelectionToolbarCustomActionGoogleSheetsAccount | undefined,
) {
  return account?.email ?? null
}

export function sanitizeCustomActionGoogleSheetsConnection(
  connection: SelectionToolbarCustomActionGoogleSheetsConnection | undefined,
  outputSchema: SelectionToolbarCustomActionOutputField[],
): SelectionToolbarCustomActionGoogleSheetsConnection | undefined {
  if (!connection) {
    return undefined
  }

  const spreadsheetId = connection.spreadsheetId.trim()
  const connectedAccount = createGoogleSheetsConnectedAccountSnapshot(connection.connectedAccount)
  if (
    !spreadsheetId ||
    !Number.isInteger(connection.sheetId) ||
    connection.sheetId < 0 ||
    !connectedAccount
  ) {
    return undefined
  }

  const outputFieldIds = new Set(outputSchema.map((field) => field.id))
  const mappingIds = new Set<string>()
  const localFieldIds = new Set<string>()
  const columnIndexes = new Set<number>()
  const mappings = connection.mappings
    .filter((mapping) => {
      if (
        !mapping.id.trim() ||
        !outputFieldIds.has(mapping.localFieldId) ||
        !mapping.localFieldId.trim() ||
        !Number.isInteger(mapping.columnIndex) ||
        mapping.columnIndex < 0
      ) {
        return false
      }

      if (
        mappingIds.has(mapping.id) ||
        localFieldIds.has(mapping.localFieldId) ||
        columnIndexes.has(mapping.columnIndex)
      ) {
        return false
      }

      mappingIds.add(mapping.id)
      localFieldIds.add(mapping.localFieldId)
      columnIndexes.add(mapping.columnIndex)
      return true
    })
    .map((mapping) => ({
      ...mapping,
      columnNameSnapshot: mapping.columnNameSnapshot.trim() || `Column ${mapping.columnIndex + 1}`,
    }))

  return {
    spreadsheetId,
    spreadsheetNameSnapshot: connection.spreadsheetNameSnapshot.trim() || spreadsheetId,
    sheetId: connection.sheetId,
    sheetNameSnapshot: connection.sheetNameSnapshot.trim() || String(connection.sheetId),
    connectedAccount,
    mappings,
  }
}
