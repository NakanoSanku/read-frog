import type { WordHighlightStylePreset } from "@/types/config/selection-toolbar"
import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Switch } from "@/components/ui/base-ui/switch"
import { WORD_HIGHLIGHT_STYLE_PRESETS } from "@/types/config/selection-toolbar"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { WORD_HIGHLIGHT_CLASS } from "@/utils/constants/vocabulary"
import { i18n } from "@/utils/i18n"
import { buildWordHighlightCSS } from "@/utils/vocabulary/style"
import { ConfigItem } from "../../../components/config-item"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

export function WordHighlightSection() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { wordHighlight } = selectionToolbar

  const patchWordHighlight = (patch: Partial<typeof wordHighlight>) => {
    void setSelectionToolbar({ wordHighlight: { ...wordHighlight, ...patch } })
  }

  return (
    <ConfigSection
      id="selection-toolbar-word-highlight"
      title={i18n.t("options.selectionToolbar.wordHighlight.title")}
    >
      <ConfigItem
        title={i18n.t("options.selectionToolbar.wordHighlight.enable.title")}
        description={i18n.t("options.selectionToolbar.wordHighlight.enable.description")}
      >
        <Switch
          checked={wordHighlight.enabled}
          onCheckedChange={(enabled) => patchWordHighlight({ enabled })}
        />
      </ConfigItem>
      <ConfigItem
        title={i18n.t("options.selectionToolbar.wordHighlight.autoSave.title")}
        description={i18n.t("options.selectionToolbar.wordHighlight.autoSave.description")}
      >
        <Switch
          checked={wordHighlight.autoSave}
          disabled={!wordHighlight.enabled}
          onCheckedChange={(autoSave) => patchWordHighlight({ autoSave })}
        />
      </ConfigItem>
      <ConfigItem
        title={i18n.t("options.selectionToolbar.wordHighlight.autoSpeak.title")}
        description={i18n.t("options.selectionToolbar.wordHighlight.autoSpeak.description")}
      >
        <Switch
          checked={wordHighlight.autoSpeak}
          disabled={!wordHighlight.enabled}
          onCheckedChange={(autoSpeak) => patchWordHighlight({ autoSpeak })}
        />
      </ConfigItem>
      <ConfigItem
        title={i18n.t("options.selectionToolbar.wordHighlight.customStyle.title")}
        description={i18n.t("options.selectionToolbar.wordHighlight.customStyle.description")}
      >
        <Switch
          checked={wordHighlight.style.isCustom}
          disabled={!wordHighlight.enabled}
          onCheckedChange={(isCustom) =>
            patchWordHighlight({ style: { ...wordHighlight.style, isCustom } })
          }
        />
      </ConfigItem>
      {wordHighlight.style.isCustom ? (
        <ConfigNavItem
          to="/selection-toolbar/word-highlight-css"
          title={i18n.t("options.selectionToolbar.wordHighlight.cssEditor.title")}
          description={i18n.t("options.selectionToolbar.wordHighlight.cssEditor.description")}
        />
      ) : (
        <ConfigItem
          title={i18n.t("options.selectionToolbar.wordHighlight.preset.title")}
          description={i18n.t("options.selectionToolbar.wordHighlight.preset.description")}
        >
          <Select
            value={wordHighlight.style.preset}
            disabled={!wordHighlight.enabled}
            onValueChange={(preset: WordHighlightStylePreset | null) => {
              if (!preset) return
              patchWordHighlight({ style: { ...wordHighlight.style, preset } })
            }}
          >
            <SelectTrigger size="sm">
              <SelectValue render={<span />}>
                {i18n.t(
                  `options.selectionToolbar.wordHighlight.preset.${wordHighlight.style.preset}`,
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent {...SELECT_CONTENT_PROPS}>
              <SelectGroup>
                {WORD_HIGHLIGHT_STYLE_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {i18n.t(`options.selectionToolbar.wordHighlight.preset.${preset}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ConfigItem>
      )}
      <div className="flex w-full flex-col gap-2">
        <span className="text-sm leading-5 font-medium">
          {i18n.t("options.selectionToolbar.wordHighlight.preview")}
        </span>
        <div className="rounded-md border p-4 text-sm leading-7">
          {wordHighlight.enabled && <style>{buildWordHighlightCSS(wordHighlight)}</style>}
          {i18n.t("options.selectionToolbar.wordHighlight.previewBefore")}{" "}
          <span className={WORD_HIGHLIGHT_CLASS} data-read-frog-word-highlight="serendipity">
            serendipity
          </span>{" "}
          {i18n.t("options.selectionToolbar.wordHighlight.previewAfter")}
        </div>
      </div>
    </ConfigSection>
  )
}
