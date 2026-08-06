import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Button } from "@/components/ui/base-ui/button"
import { toastManager } from "@/components/ui/base-ui/toast"
import { i18n } from "@/utils/i18n"
import { saveVocabularyEntry } from "@/utils/vocabulary/storage"
import { useSaveToGoogleSheets } from "./use-save-to-google-sheets"

export function SaveToGoogleSheetsButton({
  action,
  isRunning,
  result,
  vocabulary,
}: {
  action: SelectionToolbarCustomAction
  isRunning: boolean
  result: Record<string, unknown> | null
  vocabulary?: {
    term: string
    context?: string | null
    title?: string | null
  }
}) {
  const { save, isSaving } = useSaveToGoogleSheets()

  return (
    <Button
      type="button"
      size="sm"
      variant="brand"
      disabled={isRunning || !result || isSaving}
      onClick={async () => {
        if (result) {
          const outcome = await save({
            action,
            results: [result],
            analyticsSource: "custom_action",
          })
          if (outcome === "saved" && vocabulary) {
            try {
              await saveVocabularyEntry({
                term: vocabulary.term,
                context: vocabulary.context,
                sourceTitle: vocabulary.title,
                sourceUrl: window.location.href,
              })
            } catch (error) {
              toastManager.add({
                type: "error",
                title: i18n.t("wordHighlight.failed"),
                description: error instanceof Error ? error.message : String(error),
              })
            }
          }
        }
      }}
    >
      {isSaving ? i18n.t("action.saveToGoogleSheetsSaving") : i18n.t("action.saveToGoogleSheets")}
    </Button>
  )
}
