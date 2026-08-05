import type { GoogleSheetSchema } from "../api"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import { buildGoogleSheetRows, validateGoogleSheetsMappings } from "../mapping"

function createSchema(): GoogleSheetSchema {
  return {
    spreadsheetId: "spreadsheet-id",
    title: "Reading notes",
    url: "https://docs.google.com/spreadsheets/d/spreadsheet-id/edit",
    sheets: [{ sheetId: 7, title: "Notes" }],
    sheetId: 7,
    sheetTitle: "Notes",
    columns: [
      { columnIndex: 0, name: "Summary" },
      { columnIndex: 2, name: "Score" },
    ],
  }
}

function createAction(): SelectionToolbarCustomAction {
  return {
    id: "action-1",
    name: "Reading note",
    icon: "tabler:note",
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
      {
        id: "field-score",
        name: "score",
        type: "number",
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
        {
          id: "mapping-score",
          localFieldId: "field-score",
          columnIndex: 2,
          columnNameSnapshot: "Score",
        },
      ],
    },
  }
}

describe("Google Sheets field mappings", () => {
  it("builds rows at stable column indexes and preserves unmapped gaps", () => {
    const result = buildGoogleSheetRows(createAction(), createSchema(), [
      { summary: "A useful idea", score: 9 },
      { summary: "Another idea", score: 7 },
    ])

    expect(result.validation.kind).toBe("valid")
    expect(result.rows).toEqual([
      ["A useful idea", "", 9],
      ["Another idea", "", 7],
    ])
  })

  it("blocks writes when a column at the saved index was renamed or shifted", () => {
    const schema = createSchema()
    schema.columns[1] = { columnIndex: 2, name: "Inserted column" }

    const validation = validateGoogleSheetsMappings(createAction(), schema)

    expect(validation).toMatchObject({ kind: "invalid", reason: "renamed_remote" })
  })

  it("blocks writes when a mapped header disappears", () => {
    const schema = createSchema()
    schema.columns = schema.columns.filter((column) => column.columnIndex !== 2)

    const validation = validateGoogleSheetsMappings(createAction(), schema)

    expect(validation).toMatchObject({ kind: "invalid", reason: "missing_remote" })
  })
})
