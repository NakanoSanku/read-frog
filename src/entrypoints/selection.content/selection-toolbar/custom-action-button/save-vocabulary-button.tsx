import { IconBookmark, IconBookmarkFilled } from "@tabler/icons-react"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { toastManager } from "@/components/ui/base-ui/toast"
import { useIsVocabularySaved } from "@/hooks/use-saved-vocabulary"
import { i18n } from "@/utils/i18n"
import { removeVocabularyEntry, saveVocabularyEntry } from "@/utils/vocabulary/storage"

export function SaveVocabularyButton({
  term,
  context,
  title,
}: {
  term: string
  context?: string | null
  title?: string | null
}) {
  const isSaved = useIsVocabularySaved(term)
  const [isSaving, setIsSaving] = useState(false)
  const buttonLabel = isSaved ? i18n.t("wordHighlight.remove") : i18n.t("wordHighlight.save")

  const toggleSaved = async () => {
    setIsSaving(true)
    try {
      if (isSaved) {
        await removeVocabularyEntry(term)
        toastManager.add({ type: "success", title: i18n.t("wordHighlight.removed") })
      } else {
        await saveVocabularyEntry({
          term,
          context,
          sourceTitle: title,
          sourceUrl: window.location.href,
        })
        toastManager.add({ type: "success", title: i18n.t("wordHighlight.saved") })
      }
    } catch (error) {
      toastManager.add({
        type: "error",
        title: i18n.t("wordHighlight.failed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Button
      type="button"
      size="icon-sm"
      variant={isSaved ? "secondary" : "outline"}
      disabled={isSaving}
      aria-pressed={isSaved}
      aria-label={buttonLabel}
      title={buttonLabel}
      onClick={() => void toggleSaved()}
    >
      {isSaved ? <IconBookmarkFilled /> : <IconBookmark />}
    </Button>
  )
}
