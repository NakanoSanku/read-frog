import type { GoogleSheetColumn, GoogleSheetSchema } from "./api"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionGoogleSheetsConnection,
  SelectionToolbarCustomActionGoogleSheetsMapping,
  SelectionToolbarCustomActionOutputField,
} from "@/types/config/selection-toolbar"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { sanitizeCustomActionGoogleSheetsConnection } from "./connection"

export type ResolvedGoogleSheetsMappingStatus =
  | "valid"
  | "missing_local"
  | "missing_remote"
  | "renamed_remote"
  | "missing_schema"

export interface ResolvedGoogleSheetsMapping {
  localField: SelectionToolbarCustomActionOutputField | null
  mapping: SelectionToolbarCustomActionGoogleSheetsMapping
  column: GoogleSheetColumn | null
  status: ResolvedGoogleSheetsMappingStatus
}

export type GoogleSheetsMappingValidation =
  | { kind: "valid"; resolvedMappings: ResolvedGoogleSheetsMapping[] }
  | {
      kind: "invalid"
      reason: Exclude<ResolvedGoogleSheetsMappingStatus, "valid">
      resolvedMappings: ResolvedGoogleSheetsMapping[]
    }
  | { kind: "empty"; resolvedMappings: ResolvedGoogleSheetsMapping[] }

export function createGoogleSheetsMapping(
  localFieldId: string,
  column: GoogleSheetColumn,
): SelectionToolbarCustomActionGoogleSheetsMapping {
  return {
    id: getRandomUUID(),
    localFieldId,
    columnIndex: column.columnIndex,
    columnNameSnapshot: column.name,
  }
}

export function resolveGoogleSheetsMappings(
  action: SelectionToolbarCustomAction,
  schema: GoogleSheetSchema | null | undefined,
): ResolvedGoogleSheetsMapping[] {
  const connection = sanitizeCustomActionGoogleSheetsConnection(
    action.googleSheetsConnection,
    action.outputSchema,
  )
  if (!connection) {
    return []
  }

  const outputFields = new Map(action.outputSchema.map((field) => [field.id, field]))
  const columns = new Map(schema?.columns.map((column) => [column.columnIndex, column]) ?? [])

  return connection.mappings.map((mapping) => {
    const localField = outputFields.get(mapping.localFieldId) ?? null
    const column = columns.get(mapping.columnIndex) ?? null

    if (!localField) {
      return { localField, mapping, column, status: "missing_local" }
    }

    if (!schema) {
      return { localField, mapping, column, status: "missing_schema" }
    }

    if (!column) {
      return { localField, mapping, column, status: "missing_remote" }
    }

    if (column.name !== mapping.columnNameSnapshot) {
      return { localField, mapping, column, status: "renamed_remote" }
    }

    return { localField, mapping, column, status: "valid" }
  })
}

export function validateGoogleSheetsMappings(
  action: SelectionToolbarCustomAction,
  schema: GoogleSheetSchema,
): GoogleSheetsMappingValidation {
  const resolvedMappings = resolveGoogleSheetsMappings(action, schema)
  if (resolvedMappings.length === 0) {
    return { kind: "empty", resolvedMappings }
  }

  const invalidMapping = resolvedMappings.find(
    (
      mapping,
    ): mapping is ResolvedGoogleSheetsMapping & {
      status: Exclude<ResolvedGoogleSheetsMappingStatus, "valid">
    } => mapping.status !== "valid",
  )

  return invalidMapping
    ? { kind: "invalid", reason: invalidMapping.status, resolvedMappings }
    : { kind: "valid", resolvedMappings }
}

export function getNextGoogleSheetsMapping(
  connection: SelectionToolbarCustomActionGoogleSheetsConnection,
  outputSchema: SelectionToolbarCustomActionOutputField[],
  columns: GoogleSheetColumn[],
) {
  const usedLocalFieldIds = new Set(connection.mappings.map((mapping) => mapping.localFieldId))
  const usedColumnIndexes = new Set(connection.mappings.map((mapping) => mapping.columnIndex))

  for (const localField of outputSchema) {
    if (usedLocalFieldIds.has(localField.id)) {
      continue
    }

    const exactColumn = columns.find(
      (column) =>
        !usedColumnIndexes.has(column.columnIndex) &&
        column.name.localeCompare(localField.name, undefined, { sensitivity: "accent" }) === 0,
    )
    const column =
      exactColumn ?? columns.find((candidate) => !usedColumnIndexes.has(candidate.columnIndex))
    if (column) {
      return createGoogleSheetsMapping(localField.id, column)
    }
  }

  return null
}

export function createSuggestedGoogleSheetsMappings(
  outputSchema: SelectionToolbarCustomActionOutputField[],
  columns: GoogleSheetColumn[],
) {
  const mappings: SelectionToolbarCustomActionGoogleSheetsMapping[] = []
  const usedColumnIndexes = new Set<number>()

  for (const localField of outputSchema) {
    const column = columns.find(
      (candidate) =>
        !usedColumnIndexes.has(candidate.columnIndex) &&
        candidate.name.localeCompare(localField.name, undefined, { sensitivity: "accent" }) === 0,
    )
    if (!column) {
      continue
    }

    usedColumnIndexes.add(column.columnIndex)
    mappings.push(createGoogleSheetsMapping(localField.id, column))
  }

  return mappings
}

function normalizeGoogleSheetValue(value: unknown): string | number {
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : `${value}`
  }
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "boolean" || typeof value === "bigint") {
    return `${value}`
  }

  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return ""
  }
}

export function buildGoogleSheetRows(
  action: SelectionToolbarCustomAction,
  schema: GoogleSheetSchema,
  results: Array<Record<string, unknown>>,
) {
  const validation = validateGoogleSheetsMappings(action, schema)
  if (validation.kind !== "valid") {
    return { rows: [], validation }
  }

  const widestColumnIndex = Math.max(
    ...validation.resolvedMappings.map(({ mapping }) => mapping.columnIndex),
  )
  const rows = results.map((result) => {
    const row: Array<string | number> = Array.from({ length: widestColumnIndex + 1 }, () => "")
    for (const { localField, mapping } of validation.resolvedMappings) {
      if (localField) {
        row[mapping.columnIndex] = normalizeGoogleSheetValue(result[localField.name])
      }
    }
    return row
  })

  return { rows, validation }
}
