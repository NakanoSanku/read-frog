import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v094-to-v095"

describe("migration v094 to v095", () => {
  it("adds word highlighting preferences without changing existing toolbar settings", () => {
    const oldConfig = {
      selectionToolbar: {
        enabled: false,
        opacity: 72,
      },
    }

    expect(migrate(oldConfig)).toEqual({
      selectionToolbar: {
        enabled: false,
        opacity: 72,
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
    })
    expect(oldConfig.selectionToolbar).not.toHaveProperty("wordHighlight")
  })

  it("is idempotent and preserves an existing word highlighting config", () => {
    const config = {
      selectionToolbar: {
        wordHighlight: {
          enabled: false,
          autoSave: true,
          autoSpeak: true,
          style: {
            preset: "underline",
            isCustom: true,
            customCSS: ".read-frog-word-highlight { color: red; }",
          },
        },
      },
    }

    expect(migrate(config)).toBe(config)
    expect(migrate(migrate(config))).toBe(config)
  })

  it("leaves malformed config containers untouched", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate({ selectionToolbar: null })).toEqual({ selectionToolbar: null })
  })
})
