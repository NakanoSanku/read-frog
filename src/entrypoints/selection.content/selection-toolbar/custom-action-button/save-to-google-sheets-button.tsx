import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"
import { useSaveToGoogleSheets } from "./use-save-to-google-sheets"

export function SaveToGoogleSheetsButton({
  action,
  isRunning,
  result,
}: {
  action: SelectionToolbarCustomAction
  isRunning: boolean
  result: Record<string, unknown> | null
}) {
  const { save, isSaving } = useSaveToGoogleSheets()

  return (
    <Button
      type="button"
      size="sm"
      variant="brand"
      disabled={isRunning || !result || isSaving}
      onClick={() => {
        if (result) {
          void save({ action, results: [result], analyticsSource: "custom_action" })
        }
      }}
    >
      {isSaving ? i18n.t("action.saveToGoogleSheetsSaving") : i18n.t("action.saveToGoogleSheets")}
    </Button>
  )
}
