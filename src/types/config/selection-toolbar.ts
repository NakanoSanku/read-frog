import { z } from "zod"

export const selectionToolbarCustomActionOutputTypeSchema = z.enum(["string", "number"])

export const selectionToolbarCustomActionOutputFieldSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().trim().min(1),
  type: selectionToolbarCustomActionOutputTypeSchema,
  description: z.string(),
  speaking: z.boolean(),
})

export const selectionToolbarCustomActionNotebaseMappingSchema = z.object({
  id: z.string().nonempty(),
  localFieldId: z.string().nonempty(),
  notebaseColumnId: z.string().nonempty(),
  notebaseColumnNameSnapshot: z.string().trim().min(1),
})

export const selectionToolbarCustomActionNotebaseAccountSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().min(1),
  image: z.string().trim().min(1).nullable().optional(),
})

export const selectionToolbarCustomActionNotebaseConnectionSchema = z.object({
  notebaseId: z.string().nonempty(),
  notebaseNameSnapshot: z.string().trim().min(1),
  connectedAccount: selectionToolbarCustomActionNotebaseAccountSchema,
  mappings: z.array(selectionToolbarCustomActionNotebaseMappingSchema),
})

export const selectionToolbarCustomActionGoogleSheetsMappingSchema = z.object({
  id: z.string().nonempty(),
  localFieldId: z.string().nonempty(),
  columnIndex: z.number().int().nonnegative(),
  columnNameSnapshot: z.string().trim().min(1),
})

export const selectionToolbarCustomActionGoogleSheetsAccountSchema = z.object({
  id: z.string().trim().min(1),
  email: z.email(),
  image: z.url().nullable().optional(),
})

export const selectionToolbarCustomActionGoogleSheetsConnectionSchema = z.object({
  spreadsheetId: z.string().trim().min(1),
  spreadsheetNameSnapshot: z.string().trim().min(1),
  sheetId: z.number().int().nonnegative(),
  sheetNameSnapshot: z.string().trim().min(1),
  connectedAccount: selectionToolbarCustomActionGoogleSheetsAccountSchema,
  mappings: z.array(selectionToolbarCustomActionGoogleSheetsMappingSchema),
})

export const selectionToolbarBuiltInActionStateSchema = z.object({
  enabled: z.boolean(),
  providerId: z.string().nonempty(),
  notebaseConnection: selectionToolbarCustomActionNotebaseConnectionSchema.optional(),
  googleSheetsConnection: selectionToolbarCustomActionGoogleSheetsConnectionSchema.optional(),
})

export const selectionToolbarBuiltInActionsSchema = z.object({
  dictionary: selectionToolbarBuiltInActionStateSchema,
})

export const selectionToolbarCustomActionSchema = z
  .object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    enabled: z.boolean().optional(),
    icon: z.string(),
    providerId: z.string().nonempty(),
    systemPrompt: z.string(),
    prompt: z.string(),
    outputSchema: z.array(selectionToolbarCustomActionOutputFieldSchema).min(1),
    notebaseConnection: selectionToolbarCustomActionNotebaseConnectionSchema.optional(),
    googleSheetsConnection: selectionToolbarCustomActionGoogleSheetsConnectionSchema.optional(),
  })
  .superRefine((action, ctx) => {
    const nameSet = new Set<string>()
    const outputFieldIds = new Set<string>()

    action.outputSchema.forEach((field, index) => {
      if (nameSet.has(field.name)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate output schema name "${field.name}".`,
          path: ["outputSchema", index, "name"],
        })
        return
      }
      nameSet.add(field.name)
      outputFieldIds.add(field.id)
    })

    const googleSheetsConnection = action.googleSheetsConnection
    if (googleSheetsConnection) {
      const googleSheetsMappingIdSet = new Set<string>()
      const googleSheetsLocalFieldIdSet = new Set<string>()
      const googleSheetsColumnIndexSet = new Set<number>()

      googleSheetsConnection.mappings.forEach((mapping, index) => {
        if (googleSheetsMappingIdSet.has(mapping.id)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate Google Sheets mapping id "${mapping.id}".`,
            path: ["googleSheetsConnection", "mappings", index, "id"],
          })
        }
        googleSheetsMappingIdSet.add(mapping.id)

        if (!outputFieldIds.has(mapping.localFieldId)) {
          ctx.addIssue({
            code: "custom",
            message: `Unknown output field id "${mapping.localFieldId}" in Google Sheets mapping.`,
            path: ["googleSheetsConnection", "mappings", index, "localFieldId"],
          })
        }

        if (googleSheetsLocalFieldIdSet.has(mapping.localFieldId)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate local field id "${mapping.localFieldId}" in Google Sheets mappings.`,
            path: ["googleSheetsConnection", "mappings", index, "localFieldId"],
          })
        }
        googleSheetsLocalFieldIdSet.add(mapping.localFieldId)

        if (googleSheetsColumnIndexSet.has(mapping.columnIndex)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate column index "${mapping.columnIndex}" in Google Sheets mappings.`,
            path: ["googleSheetsConnection", "mappings", index, "columnIndex"],
          })
        }
        googleSheetsColumnIndexSet.add(mapping.columnIndex)
      })
    }

    const connection = action.notebaseConnection
    if (!connection) {
      return
    }

    const mappingIdSet = new Set<string>()
    const localFieldIdSet = new Set<string>()
    const notebaseColumnIdSet = new Set<string>()

    connection.mappings.forEach((mapping, index) => {
      if (mappingIdSet.has(mapping.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate notebase mapping id "${mapping.id}".`,
          path: ["notebaseConnection", "mappings", index, "id"],
        })
      }
      mappingIdSet.add(mapping.id)

      if (!outputFieldIds.has(mapping.localFieldId)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown output field id "${mapping.localFieldId}" in notebase mapping.`,
          path: ["notebaseConnection", "mappings", index, "localFieldId"],
        })
      }

      if (localFieldIdSet.has(mapping.localFieldId)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate local field id "${mapping.localFieldId}" in notebase mappings.`,
          path: ["notebaseConnection", "mappings", index, "localFieldId"],
        })
      }
      localFieldIdSet.add(mapping.localFieldId)

      if (notebaseColumnIdSet.has(mapping.notebaseColumnId)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate notebase column id "${mapping.notebaseColumnId}" in notebase mappings.`,
          path: ["notebaseConnection", "mappings", index, "notebaseColumnId"],
        })
      }
      notebaseColumnIdSet.add(mapping.notebaseColumnId)
    })
  })

export const selectionToolbarCustomActionsSchema = z
  .array(selectionToolbarCustomActionSchema)
  .superRefine((actions, ctx) => {
    const idSet = new Set<string>()
    actions.forEach((action, index) => {
      if (action.id === "default-dictionary") {
        ctx.addIssue({
          code: "custom",
          message: 'Action id "default-dictionary" is reserved for the built-in Dictionary.',
          path: [index, "id"],
        })
      }

      if (idSet.has(action.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate action id "${action.id}"`,
          path: [index, "id"],
        })
      }
      idSet.add(action.id)
    })

    const nameSet = new Set<string>()
    actions.forEach((action, index) => {
      if (nameSet.has(action.name)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate action name "${action.name}"`,
          path: [index, "name"],
        })
      }
      nameSet.add(action.name)
    })
  })

// TODO: make these vairbale shorter by deleteing SelectionToolbar or "selectionToolbar"
export type SelectionToolbarCustomActionOutputType = z.infer<
  typeof selectionToolbarCustomActionOutputTypeSchema
>
export type SelectionToolbarCustomActionOutputField = z.infer<
  typeof selectionToolbarCustomActionOutputFieldSchema
>
export type SelectionToolbarCustomActionNotebaseMapping = z.infer<
  typeof selectionToolbarCustomActionNotebaseMappingSchema
>
export type SelectionToolbarCustomActionNotebaseAccount = z.infer<
  typeof selectionToolbarCustomActionNotebaseAccountSchema
>
export type SelectionToolbarCustomActionNotebaseConnection = z.infer<
  typeof selectionToolbarCustomActionNotebaseConnectionSchema
>
export type SelectionToolbarCustomActionGoogleSheetsMapping = z.infer<
  typeof selectionToolbarCustomActionGoogleSheetsMappingSchema
>
export type SelectionToolbarCustomActionGoogleSheetsAccount = z.infer<
  typeof selectionToolbarCustomActionGoogleSheetsAccountSchema
>
export type SelectionToolbarCustomActionGoogleSheetsConnection = z.infer<
  typeof selectionToolbarCustomActionGoogleSheetsConnectionSchema
>
export type SelectionToolbarBuiltInActionState = z.infer<
  typeof selectionToolbarBuiltInActionStateSchema
>
export type SelectionToolbarBuiltInActions = z.infer<typeof selectionToolbarBuiltInActionsSchema>
export type SelectionToolbarCustomAction = z.infer<typeof selectionToolbarCustomActionSchema>
