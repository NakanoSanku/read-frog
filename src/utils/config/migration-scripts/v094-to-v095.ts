/**
 * Add saved-word highlighting preferences.
 *
 * IMPORTANT: This is a frozen snapshot. Keep all values and helpers inline.
 */

function isRecord(value: any): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isRecord(oldConfig) || !isRecord(oldConfig.selectionToolbar)) {
    return oldConfig
  }

  if (isRecord(oldConfig.selectionToolbar.wordHighlight)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    selectionToolbar: {
      ...oldConfig.selectionToolbar,
      wordHighlight: {
        enabled: true,
        autoSave: false,
        autoSpeak: false,
        style: {
          preset: "highlight",
          isCustom: false,
          customCSS: null,
        },
      },
    },
  }
}
