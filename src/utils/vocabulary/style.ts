import type { WordHighlightConfig } from "@/types/config/selection-toolbar"
import { WORD_HIGHLIGHT_CLASS } from "@/utils/constants/vocabulary"

const BASE_STYLE = `
.${WORD_HIGHLIGHT_CLASS} {
  cursor: pointer !important;
  border-radius: 0.2em !important;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.${WORD_HIGHLIGHT_CLASS}:hover {
  filter: brightness(0.92) !important;
}
`

const PRESET_STYLES: Record<WordHighlightConfig["style"]["preset"], string> = {
  highlight: `
.${WORD_HIGHLIGHT_CLASS} {
  color: inherit !important;
  background: linear-gradient(transparent 42%, rgba(250, 204, 21, 0.62) 42%) !important;
}`,
  underline: `
.${WORD_HIGHLIGHT_CLASS} {
  color: inherit !important;
  text-decoration-line: underline !important;
  text-decoration-style: wavy !important;
  text-decoration-color: #f59e0b !important;
  text-decoration-thickness: 0.12em !important;
  text-underline-offset: 0.16em !important;
}`,
  enlarge: `
.${WORD_HIGHLIGHT_CLASS} {
  color: #b45309 !important;
  background-color: rgba(254, 243, 199, 0.92) !important;
  font-size: 1.16em !important;
  font-weight: 700 !important;
  padding-inline: 0.08em !important;
}`,
}

export function buildWordHighlightCSS(config: WordHighlightConfig): string {
  const customCSS = config.style.customCSS?.trim()
  return `${BASE_STYLE}\n${config.style.isCustom && customCSS ? customCSS : PRESET_STYLES[config.style.preset]}`
}
