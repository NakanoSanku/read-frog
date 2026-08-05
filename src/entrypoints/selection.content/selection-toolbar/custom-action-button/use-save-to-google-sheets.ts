import type { FeatureProviderAnalytics } from "@/types/analytics"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { useAtom } from "jotai"
import { useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { patchSelectionToolbarAction } from "@/utils/custom-actions"
import { sanitizeCustomActionGoogleSheetsConnection } from "@/utils/google-sheets"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"

export type SaveToGoogleSheetsOutcome = "saved" | "failed"

export interface SaveToGoogleSheetsRequest {
  action: SelectionToolbarCustomAction
  results: Array<Record<string, unknown>>
  analyticsSource?: "custom_action" | "save_suggestion"
  analyticsProvider?: FeatureProviderAnalytics
}

export function useSaveToGoogleSheets() {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )
  const [isSaving, setIsSaving] = useState(false)

  const openConfiguration = (actionId: string) => {
    void sendMessage("openOptionsPage", {
      route: `/custom-actions?actionId=${encodeURIComponent(actionId)}`,
    })
  }

  const showConfigurationError = (actionId: string, title: string) => {
    const toastId = toastManager.add({
      type: "error",
      title,
      actionProps: {
        children: i18n.t("action.configureGoogleSheets"),
        onClick: () => {
          toastManager.close(toastId)
          openConfiguration(actionId)
        },
      },
    })
  }

  const save = async ({
    action,
    results,
  }: SaveToGoogleSheetsRequest): Promise<SaveToGoogleSheetsOutcome> => {
    const connection = sanitizeCustomActionGoogleSheetsConnection(
      action.googleSheetsConnection,
      action.outputSchema,
    )
    if (!connection || results.length === 0) {
      showConfigurationError(action.id, i18n.t("action.saveToGoogleSheetsNotConfigured"))
      return "failed"
    }

    setIsSaving(true)
    try {
      const response = await sendMessage("saveGoogleSheetsRows", { action, results })
      if (!response.ok) {
        switch (response.reason) {
          case "not_configured":
          case "mapping_invalid":
          case "account_mismatch":
          case "sheet_unavailable":
          case "spreadsheet_unavailable":
            showConfigurationError(
              action.id,
              response.reason === "account_mismatch"
                ? i18n.t("action.saveToGoogleSheetsAccountMismatch")
                : response.reason === "mapping_invalid"
                  ? i18n.t("action.saveToGoogleSheetsConnectionInvalid")
                  : i18n.t("action.saveToGoogleSheetsUnavailable"),
            )
            return "failed"
          case "access_denied":
            toastManager.add({
              type: "error",
              title: i18n.t("action.saveToGoogleSheetsAccessDenied"),
            })
            return "failed"
          case "authentication_failed":
            showConfigurationError(
              action.id,
              i18n.t("action.saveToGoogleSheetsAuthenticationFailed"),
            )
            return "failed"
          default:
            toastManager.add({
              type: "error",
              title: i18n.t("action.saveToGoogleSheetsFailed"),
              description: response.message,
            })
            return "failed"
        }
      }

      await setSelectionToolbarConfig(
        patchSelectionToolbarAction(selectionToolbarConfig, action.id, {
          googleSheetsConnection: response.connection,
        }),
      )
      const toastId = toastManager.add({
        type: "success",
        title: i18n.t("action.saveToGoogleSheetsSuccess"),
        description: `${response.spreadsheetName} · ${response.sheetName}`,
        actionProps: {
          children: i18n.t("action.openGoogleSheets"),
          onClick: () => {
            toastManager.close(toastId)
            void sendMessage("openPage", { url: response.url, active: true })
          },
        },
      })
      return "saved"
    } catch (error) {
      toastManager.add({
        type: "error",
        title: i18n.t("action.saveToGoogleSheetsFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
      return "failed"
    } finally {
      setIsSaving(false)
    }
  }

  return { save, isSaving }
}
