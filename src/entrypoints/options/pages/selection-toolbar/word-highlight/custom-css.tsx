import { useAtom, useAtomValue } from "jotai"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Field } from "@/components/ui/base-ui/field"
import { CSSCodeEditor } from "@/components/ui/css-code-editor"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { MAX_WORD_HIGHLIGHT_CUSTOM_CSS_LENGTH } from "@/types/config/selection-toolbar"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { WORD_HIGHLIGHT_CLASS } from "@/utils/constants/vocabulary"
import { lintCSS } from "@/utils/css/lint-css"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { buildWordHighlightCSS } from "@/utils/vocabulary/style"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { PageLayout } from "../../../components/page-layout"

export function WordHighlightCustomCssPage() {
  return (
    <PageLayout
      title={i18n.t("options.selectionToolbar.title")}
      description={i18n.t("options.selectionToolbar.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/selection-toolbar"
        title={i18n.t("options.selectionToolbar.wordHighlight.cssEditor.title")}
      >
        <WordHighlightCSSEditor />
        <WordHighlightPreview />
      </ConfigDetailSection>
    </PageLayout>
  )
}

function WordHighlightCSSEditor() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { wordHighlight } = selectionToolbar
  const [cssInput, setCssInput] = useState(wordHighlight.style.customCSS ?? "")
  const debouncedCssInput = useDebouncedValue(cssInput, 500)
  const syntaxCheck = useMemo(
    () => (debouncedCssInput.trim() ? lintCSS(debouncedCssInput) : { valid: true, errors: [] }),
    [debouncedCssInput],
  )
  const hasLengthError = debouncedCssInput.length > MAX_WORD_HIGHLIGHT_CUSTOM_CSS_LENGTH
  const hasSyntaxError = !syntaxCheck.valid
  const isValidating = cssInput !== debouncedCssInput
  const hasChanges = cssInput !== (wordHighlight.style.customCSS ?? "")

  const save = () => {
    if (hasSyntaxError || hasLengthError || isValidating || !hasChanges) return
    void setSelectionToolbar({
      wordHighlight: {
        ...wordHighlight,
        style: { ...wordHighlight.style, customCSS: cssInput },
      },
    })
  }

  return (
    <Field>
      <CSSCodeEditor
        value={cssInput}
        onChange={setCssInput}
        hasError={hasSyntaxError || hasLengthError}
        placeholder={i18n.t("options.selectionToolbar.wordHighlight.cssEditor.placeholder")}
        className="max-h-[400px] min-h-[200px] overflow-y-auto"
      />
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            "text-sm text-green-500",
            isValidating && "text-muted-foreground",
            (hasSyntaxError || hasLengthError) && "text-destructive",
          )}
        >
          {cssInput.trim()
            ? getValidationMessage(isValidating, hasSyntaxError, hasLengthError, hasChanges)
            : ""}
        </div>
        <Button
          onClick={save}
          disabled={isValidating || hasSyntaxError || hasLengthError || !hasChanges}
        >
          {hasChanges
            ? i18n.t("options.translation.translationStyle.customCSS.editor.saveButton")
            : i18n.t("options.translation.translationStyle.customCSS.editor.savedButton")}
        </Button>
      </div>
    </Field>
  )
}

function WordHighlightPreview() {
  const { wordHighlight } = useAtomValue(configFieldsAtomMap.selectionToolbar)
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm leading-5 font-medium">
        {i18n.t("options.selectionToolbar.wordHighlight.preview")}
      </span>
      <div className="rounded-md border p-4 text-sm leading-7">
        <style>{buildWordHighlightCSS(wordHighlight)}</style>
        {i18n.t("options.selectionToolbar.wordHighlight.previewBefore")}{" "}
        <span className={WORD_HIGHLIGHT_CLASS} data-read-frog-word-highlight="serendipity">
          serendipity
        </span>{" "}
        {i18n.t("options.selectionToolbar.wordHighlight.previewAfter")}
      </div>
    </div>
  )
}

function getValidationMessage(
  isValidating: boolean,
  hasSyntaxError: boolean,
  hasLengthError: boolean,
  hasChanges: boolean,
) {
  if (isValidating) {
    return i18n.t("options.translation.translationStyle.customCSS.editor.validation.validating")
  }
  if (hasSyntaxError) {
    return i18n.t("options.translation.translationStyle.customCSS.editor.validation.syntaxError")
  }
  if (hasLengthError) {
    return i18n.t("options.translation.translationStyle.customCSS.editor.validation.tooLong")
  }
  if (!hasChanges) {
    return i18n.t("options.translation.translationStyle.customCSS.editor.validation.saved")
  }
  return i18n.t("options.translation.translationStyle.customCSS.editor.validation.valid")
}
