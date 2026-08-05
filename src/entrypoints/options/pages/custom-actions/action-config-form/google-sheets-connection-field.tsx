import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionGoogleSheetsConnection,
  SelectionToolbarCustomActionGoogleSheetsMapping,
  SelectionToolbarCustomActionOutputField,
} from "@/types/config/selection-toolbar"
import type { GoogleSheetColumn } from "@/utils/google-sheets"
import {
  IconChevronsRight,
  IconExternalLink,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { useSelector } from "@tanstack/react-store"
import { dequal } from "dequal"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert"
import { Button } from "@/components/ui/base-ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { useGoogleSheetsAuth } from "@/hooks/use-google-sheets-auth"
import {
  authenticateGoogleDriveAndSaveTokenToStorage,
  GOOGLE_SHEETS_SCOPE,
} from "@/utils/google-drive/auth"
import {
  columnIndexToA1,
  createGoogleSheetsConnectedAccountSnapshot,
  createSuggestedGoogleSheetsMappings,
  getGoogleSheetSchema,
  getGoogleSpreadsheet,
  getGoogleSpreadsheetUrl,
  getNextGoogleSheetsMapping,
  isSameGoogleSheetsAccount,
  parseGoogleSheetsReference,
  resolveGoogleSheetsMappings,
  sanitizeCustomActionGoogleSheetsConnection,
  validateGoogleSheetsMappings,
} from "@/utils/google-sheets"
import { i18n } from "@/utils/i18n"
import { withForm } from "./form"

interface SelectItemData<T> {
  value: T
  label: string
}

function t(key: string) {
  return i18n.t(`options.selectionToolbar.customActions.form.googleSheets.${key}` as never)
}

function getMappingStatusMessage(
  status: ReturnType<typeof resolveGoogleSheetsMappings>[number]["status"],
) {
  switch (status) {
    case "missing_local":
      return t("mappingMissingLocal")
    case "missing_remote":
      return t("mappingMissingRemote")
    case "renamed_remote":
      return t("mappingRenamedRemote")
    case "missing_schema":
      return t("mappingMissingSchema")
    case "valid":
      return null
    default:
      return null
  }
}

function getSelectableLocalFields(
  outputSchema: SelectionToolbarCustomActionOutputField[],
  connection: SelectionToolbarCustomActionGoogleSheetsConnection,
  currentMapping: SelectionToolbarCustomActionGoogleSheetsMapping,
) {
  const usedFieldIds = new Set(
    connection.mappings
      .filter((mapping) => mapping.id !== currentMapping.id)
      .map((mapping) => mapping.localFieldId),
  )
  return outputSchema.filter((field) => !usedFieldIds.has(field.id))
}

function getSelectableColumns(
  columns: GoogleSheetColumn[],
  connection: SelectionToolbarCustomActionGoogleSheetsConnection,
  currentMapping: SelectionToolbarCustomActionGoogleSheetsMapping,
) {
  const usedColumnIndexes = new Set(
    connection.mappings
      .filter((mapping) => mapping.id !== currentMapping.id)
      .map((mapping) => mapping.columnIndex),
  )
  return columns.filter((column) => !usedColumnIndexes.has(column.columnIndex))
}

function getLocalFieldSelectItems(
  fields: SelectionToolbarCustomActionOutputField[],
): SelectItemData<string>[] {
  return fields.map((field) => ({ value: field.id, label: field.name }))
}

function getColumnSelectItems(
  columns: GoogleSheetColumn[],
  mapping: SelectionToolbarCustomActionGoogleSheetsMapping,
  staleReason: "removed" | "renamed" | null,
): SelectItemData<string>[] {
  return [
    ...(staleReason
      ? [
          {
            value: `stale:${mapping.columnIndex}`,
            label: `${columnIndexToA1(mapping.columnIndex)} · ${mapping.columnNameSnapshot} (${t(
              staleReason === "removed" ? "columnUnavailableOption" : "columnOutdatedOption",
            )})`,
          },
        ]
      : []),
    ...columns.map((column) => ({
      value: String(column.columnIndex),
      label: `${columnIndexToA1(column.columnIndex)} · ${column.name}`,
    })),
  ]
}

export const GoogleSheetsConnectionField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomAction },
  render: function Render({ form }) {
    const action = useSelector(form.store, (state) => state.values)
    const outputSchema = action.outputSchema
    const connection = action.googleSheetsConnection
    const [referenceInput, setReferenceInput] = useState("")
    const [isConnecting, setIsConnecting] = useState(false)
    const [connectionError, setConnectionError] = useState<string | null>(null)
    const {
      query: { data: authData, isPending: isAuthPending },
      invalidate: invalidateAuth,
    } = useGoogleSheetsAuth()
    const currentAccount = useMemo(
      () => createGoogleSheetsConnectedAccountSnapshot(authData?.userInfo),
      [authData?.userInfo],
    )
    const sanitizedConnection = useMemo(
      () => sanitizeCustomActionGoogleSheetsConnection(connection, outputSchema),
      [connection, outputSchema],
    )
    const accountMismatch =
      !!sanitizedConnection &&
      !!currentAccount &&
      !isSameGoogleSheetsAccount(sanitizedConnection.connectedAccount, currentAccount)

    const updateConnection = useCallback(
      (nextConnection: SelectionToolbarCustomActionGoogleSheetsConnection | undefined) => {
        form.setFieldValue("googleSheetsConnection", nextConnection)
        void form.handleSubmit()
      },
      [form],
    )

    const schemaQuery = useQuery({
      queryKey: [
        "google-sheets-schema",
        currentAccount?.id,
        sanitizedConnection?.spreadsheetId,
        sanitizedConnection?.sheetId,
      ],
      queryFn: () =>
        getGoogleSheetSchema(
          sanitizedConnection?.spreadsheetId ?? "",
          sanitizedConnection?.sheetId ?? 0,
        ),
      enabled:
        !!authData?.isAuthenticated &&
        !!currentAccount &&
        !!sanitizedConnection &&
        !accountMismatch,
      retry: false,
      staleTime: 60_000,
    })

    useEffect(() => {
      if (!dequal(connection, sanitizedConnection)) {
        form.setFieldValue("googleSheetsConnection", sanitizedConnection)
        void form.handleSubmit()
      }
    }, [connection, form, sanitizedConnection])

    useEffect(() => {
      if (!schemaQuery.data || !sanitizedConnection || !currentAccount) {
        return
      }

      const refreshedConnection = {
        ...sanitizedConnection,
        spreadsheetNameSnapshot: schemaQuery.data.title,
        sheetNameSnapshot: schemaQuery.data.sheetTitle,
        connectedAccount: currentAccount,
      }
      if (!dequal(refreshedConnection, sanitizedConnection)) {
        updateConnection(refreshedConnection)
      }
    }, [currentAccount, sanitizedConnection, schemaQuery.data, updateConnection])

    const mappingValidation = useMemo(
      () =>
        schemaQuery.data
          ? validateGoogleSheetsMappings(
              { ...action, googleSheetsConnection: sanitizedConnection },
              schemaQuery.data,
            )
          : null,
      [action, sanitizedConnection, schemaQuery.data],
    )
    const resolvedMappings = useMemo(
      () =>
        mappingValidation?.resolvedMappings ??
        resolveGoogleSheetsMappings(
          { ...action, googleSheetsConnection: sanitizedConnection },
          schemaQuery.data,
        ),
      [action, mappingValidation?.resolvedMappings, sanitizedConnection, schemaQuery.data],
    )

    const handleAuthenticate = async () => {
      setConnectionError(null)
      try {
        await authenticateGoogleDriveAndSaveTokenToStorage([GOOGLE_SHEETS_SCOPE])
        await invalidateAuth()
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : String(error))
      }
    }

    const handleConnect = async () => {
      const reference = parseGoogleSheetsReference(referenceInput)
      if (!reference || !currentAccount) {
        setConnectionError(t("invalidReferenceError"))
        return
      }

      setIsConnecting(true)
      setConnectionError(null)
      try {
        const spreadsheet = await getGoogleSpreadsheet(reference.spreadsheetId)
        const sheet =
          reference.sheetId === undefined
            ? spreadsheet.sheets[0]
            : spreadsheet.sheets.find((candidate) => candidate.sheetId === reference.sheetId)
        if (!sheet) {
          setConnectionError(t("noGridSheetsError"))
          return
        }

        const schema = await getGoogleSheetSchema(spreadsheet.spreadsheetId, sheet.sheetId)
        updateConnection({
          spreadsheetId: spreadsheet.spreadsheetId,
          spreadsheetNameSnapshot: spreadsheet.title,
          sheetId: sheet.sheetId,
          sheetNameSnapshot: sheet.title,
          connectedAccount: currentAccount,
          mappings: createSuggestedGoogleSheetsMappings(outputSchema, schema.columns),
        })
        setReferenceInput("")
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : String(error))
      } finally {
        setIsConnecting(false)
      }
    }

    const handleSheetChange = async (value: string | null) => {
      if (!sanitizedConnection || !currentAccount || !value) {
        return
      }
      const sheetId = Number(value)
      if (!Number.isInteger(sheetId)) {
        return
      }

      setIsConnecting(true)
      setConnectionError(null)
      try {
        const schema = await getGoogleSheetSchema(sanitizedConnection.spreadsheetId, sheetId)
        updateConnection({
          ...sanitizedConnection,
          spreadsheetNameSnapshot: schema.title,
          sheetId,
          sheetNameSnapshot: schema.sheetTitle,
          connectedAccount: currentAccount,
          mappings: createSuggestedGoogleSheetsMappings(outputSchema, schema.columns),
        })
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : String(error))
      } finally {
        setIsConnecting(false)
      }
    }

    const handleRefresh = async () => {
      await schemaQuery.refetch()
    }

    const handleAddMapping = () => {
      if (!sanitizedConnection || !schemaQuery.data) {
        return
      }
      const mapping = getNextGoogleSheetsMapping(
        sanitizedConnection,
        outputSchema,
        schemaQuery.data.columns,
      )
      if (mapping) {
        updateConnection({
          ...sanitizedConnection,
          mappings: [...sanitizedConnection.mappings, mapping],
        })
      }
    }

    return (
      <Field className="gap-4 rounded-xl border border-dashed bg-muted/10 p-4">
        <div className="space-y-1">
          <FieldLabel nativeLabel={false} render={<div />}>
            {t("title")}
          </FieldLabel>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        {!authData?.isAuthenticated && !isAuthPending && (
          <Alert>
            <AlertTitle>{t("authRequiredTitle")}</AlertTitle>
            <AlertDescription>{t("authRequiredDescription")}</AlertDescription>
            <AlertAction>
              <Button type="button" size="sm" variant="outline" onClick={handleAuthenticate}>
                {t("authAction")}
              </Button>
            </AlertAction>
          </Alert>
        )}

        {authData?.isAuthenticated && currentAccount && (
          <FieldGroup className="gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {currentAccount.image && (
                <img
                  src={currentAccount.image}
                  alt=""
                  className="size-5 rounded-full border"
                  referrerPolicy="no-referrer"
                />
              )}
              <span>{currentAccount.email}</span>
            </div>

            <Field>
              <FieldLabel>{t("spreadsheetLabel")}</FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={referenceInput}
                  placeholder={t("spreadsheetPlaceholder")}
                  onChange={(event) => setReferenceInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      void handleConnect()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!referenceInput.trim() || isConnecting}
                  onClick={() => void handleConnect()}
                >
                  {isConnecting ? t("connectingAction") : t("connectAction")}
                </Button>
              </div>
            </Field>

            {accountMismatch && sanitizedConnection && (
              <Alert variant="destructive">
                <AlertTitle>{t("accountMismatchTitle")}</AlertTitle>
                <AlertDescription>
                  {t("accountMismatchDescription")} {sanitizedConnection.connectedAccount.email}
                </AlertDescription>
                <AlertAction>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => updateConnection(undefined)}
                  >
                    {t("disconnectAction")}
                  </Button>
                </AlertAction>
              </Alert>
            )}

            {connectionError && (
              <Alert variant="destructive">
                <AlertTitle>{t("connectionErrorTitle")}</AlertTitle>
                <AlertDescription>{connectionError}</AlertDescription>
              </Alert>
            )}

            {sanitizedConnection && !accountMismatch && (
              <>
                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel nativeLabel={false} render={<div />}>
                      {sanitizedConnection.spreadsheetNameSnapshot}
                    </FieldLabel>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        render={
                          <a
                            href={getGoogleSpreadsheetUrl(
                              sanitizedConnection.spreadsheetId,
                              sanitizedConnection.sheetId,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <IconExternalLink />
                        {t("openAction")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={schemaQuery.isFetching}
                        onClick={() => void handleRefresh()}
                      >
                        <IconRefresh
                          className={schemaQuery.isFetching ? "animate-spin" : undefined}
                        />
                        {t("refreshAction")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateConnection(undefined)}
                      >
                        {t("disconnectAction")}
                      </Button>
                    </div>
                  </div>
                </Field>

                {schemaQuery.isPending && (
                  <p className="text-sm text-muted-foreground">{t("schemaLoading")}</p>
                )}

                {schemaQuery.error && (
                  <Alert variant="destructive">
                    <AlertTitle>{t("schemaErrorTitle")}</AlertTitle>
                    <AlertDescription>
                      {schemaQuery.error instanceof Error
                        ? schemaQuery.error.message
                        : t("schemaErrorDescription")}
                    </AlertDescription>
                  </Alert>
                )}

                {schemaQuery.data && (
                  <>
                    <Field>
                      <FieldLabel>{t("sheetLabel")}</FieldLabel>
                      <Select<string>
                        value={String(sanitizedConnection.sheetId)}
                        items={schemaQuery.data.sheets.map((sheet) => ({
                          value: String(sheet.sheetId),
                          label: sheet.title,
                        }))}
                        onValueChange={handleSheetChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {schemaQuery.data.sheets.map((sheet) => (
                              <SelectItem key={sheet.sheetId} value={String(sheet.sheetId)}>
                                {sheet.title}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>

                    {schemaQuery.data.columns.length === 0 && (
                      <Alert>
                        <AlertTitle>{t("emptyHeadersTitle")}</AlertTitle>
                        <AlertDescription>{t("emptyHeadersDescription")}</AlertDescription>
                      </Alert>
                    )}

                    {mappingValidation?.kind === "invalid" && (
                      <Alert variant="destructive">
                        <AlertTitle>{t("invalidMappingsTitle")}</AlertTitle>
                        <AlertDescription>{t("invalidMappingsDescription")}</AlertDescription>
                      </Alert>
                    )}

                    <Field className="gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <FieldLabel nativeLabel={false} render={<div />}>
                          {t("mappingsLabel")}
                        </FieldLabel>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleAddMapping}
                          disabled={
                            !getNextGoogleSheetsMapping(
                              sanitizedConnection,
                              outputSchema,
                              schemaQuery.data.columns,
                            )
                          }
                        >
                          <IconPlus className="size-4" />
                          {t("addMappingAction")}
                        </Button>
                      </div>

                      {sanitizedConnection.mappings.length === 0 && (
                        <p className="text-sm text-muted-foreground">{t("mappingsEmpty")}</p>
                      )}

                      <div className="space-y-2">
                        <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-center">
                          <span>{t("localFieldLabel")}</span>
                          <span />
                          <span>{t("remoteFieldLabel")}</span>
                          <span />
                        </div>

                        {resolvedMappings.map(({ mapping, column, status }) => {
                          const localOptions = getSelectableLocalFields(
                            outputSchema,
                            sanitizedConnection,
                            mapping,
                          )
                          const columnOptions = getSelectableColumns(
                            schemaQuery.data.columns,
                            sanitizedConnection,
                            mapping,
                          )
                          const currentColumnMissing = !schemaQuery.data.columns.some(
                            (candidate) => candidate.columnIndex === mapping.columnIndex,
                          )
                          const staleColumnReason = currentColumnMissing
                            ? "removed"
                            : status === "renamed_remote"
                              ? "renamed"
                              : null
                          const staleColumnValue = `stale:${mapping.columnIndex}`

                          return (
                            <div key={mapping.id} className="space-y-1.5">
                              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-center">
                                <Select<string>
                                  value={mapping.localFieldId}
                                  items={getLocalFieldSelectItems(localOptions)}
                                  onValueChange={(value) => {
                                    if (typeof value !== "string") return
                                    updateConnection({
                                      ...sanitizedConnection,
                                      mappings: sanitizedConnection.mappings.map((item) =>
                                        item.id === mapping.id
                                          ? { ...item, localFieldId: value }
                                          : item,
                                      ),
                                    })
                                  }}
                                >
                                  <SelectTrigger
                                    className="w-full"
                                    aria-invalid={status !== "valid"}
                                  >
                                    <SelectValue placeholder={t("localFieldPlaceholder")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {localOptions.map((field) => (
                                        <SelectItem key={field.id} value={field.id}>
                                          {field.name}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>

                                <div className="hidden items-center justify-center text-muted-foreground md:flex">
                                  <IconChevronsRight className="size-4" />
                                </div>

                                <Select<string>
                                  value={
                                    staleColumnReason
                                      ? staleColumnValue
                                      : String(mapping.columnIndex)
                                  }
                                  items={getColumnSelectItems(
                                    columnOptions,
                                    mapping,
                                    staleColumnReason,
                                  )}
                                  onValueChange={(value) => {
                                    if (typeof value !== "string") return
                                    const columnIndex = Number(value)
                                    const nextColumn = schemaQuery.data.columns.find(
                                      (candidate) => candidate.columnIndex === columnIndex,
                                    )
                                    if (!nextColumn) return
                                    updateConnection({
                                      ...sanitizedConnection,
                                      mappings: sanitizedConnection.mappings.map((item) =>
                                        item.id === mapping.id
                                          ? {
                                              ...item,
                                              columnIndex,
                                              columnNameSnapshot: nextColumn.name,
                                            }
                                          : item,
                                      ),
                                    })
                                  }}
                                >
                                  <SelectTrigger
                                    className="w-full"
                                    aria-invalid={status !== "valid"}
                                  >
                                    <SelectValue placeholder={t("remoteFieldPlaceholder")}>
                                      {column?.name ?? mapping.columnNameSnapshot}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {staleColumnReason && (
                                        <SelectItem value={staleColumnValue}>
                                          {`${columnIndexToA1(mapping.columnIndex)} · ${mapping.columnNameSnapshot} (${t(
                                            staleColumnReason === "removed"
                                              ? "columnUnavailableOption"
                                              : "columnOutdatedOption",
                                          )})`}
                                        </SelectItem>
                                      )}
                                      {columnOptions.map((candidate) => (
                                        <SelectItem
                                          key={candidate.columnIndex}
                                          value={String(candidate.columnIndex)}
                                        >
                                          {`${columnIndexToA1(candidate.columnIndex)} · ${candidate.name}`}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>

                                <div className="flex justify-end md:justify-start">
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={t("removeMappingAction")}
                                    title={t("removeMappingAction")}
                                    onClick={() =>
                                      updateConnection({
                                        ...sanitizedConnection,
                                        mappings: sanitizedConnection.mappings.filter(
                                          (item) => item.id !== mapping.id,
                                        ),
                                      })
                                    }
                                  >
                                    <IconTrash />
                                  </Button>
                                </div>
                              </div>

                              {status !== "valid" && (
                                <p className="px-1 text-xs text-destructive">
                                  {getMappingStatusMessage(status)}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </Field>
                  </>
                )}
              </>
            )}
          </FieldGroup>
        )}
      </Field>
    )
  },
})
