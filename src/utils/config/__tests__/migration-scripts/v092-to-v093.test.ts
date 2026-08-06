import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrate } from "../../migration-scripts/v092-to-v093"
import { testSeries as v092TestSeries } from "../example/v092"

describe("v092-to-v093 migration", () => {
  it("replaces legacy providers and reassigns every feature", () => {
    const oldConfig = {
      providersConfig: [
        {
          id: "openai-old",
          name: "OpenAI",
          enabled: true,
          provider: "openai",
          model: { model: "gpt-5", isCustomModel: false, customModel: null },
        },
        {
          id: "xai-old",
          name: "xAI",
          enabled: true,
          provider: "xai",
          model: { model: "grok-4", isCustomModel: false, customModel: null },
        },
      ],
      translate: { providerId: "openai-old" },
      inputTranslation: { providerId: "openai-old" },
      videoSubtitles: { providerId: "xai-old" },
      languageDetection: { mode: "llm", providerId: "xai-old" },
      selectionToolbar: {
        features: { translate: { enabled: true, providerId: "openai-old" } },
        builtInActions: { dictionary: { enabled: true, providerId: "xai-old" } },
        customActions: [
          { id: "one", providerId: "openai-old" },
          { id: "two", providerId: "xai-old" },
        ],
      },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.providersConfig).toEqual([
      expect.objectContaining({
        id: "cli-proxy-api-default",
        provider: "cli-proxy-api",
        baseURL: "http://127.0.0.1:8317/v1",
        enabled: true,
      }),
      expect.objectContaining({
        id: "grok2api-default",
        provider: "grok2api",
        baseURL: "http://127.0.0.1:8000/v1",
        enabled: true,
      }),
    ])
    expect(migrated.providersConfig.every((provider: any) => provider.model.isCustomModel)).toBe(
      true,
    )
    expect(migrated.translate.providerId).toBe("cli-proxy-api-default")
    expect(migrated.inputTranslation.providerId).toBe("cli-proxy-api-default")
    expect(migrated.videoSubtitles.providerId).toBe("grok2api-default")
    expect(migrated.languageDetection.providerId).toBe("grok2api-default")
    expect(migrated.selectionToolbar.features.translate.providerId).toBe("cli-proxy-api-default")
    expect(migrated.selectionToolbar.builtInActions.dictionary.providerId).toBe("grok2api-default")
    expect(migrated.selectionToolbar.customActions.map((action: any) => action.providerId)).toEqual(
      ["cli-proxy-api-default", "grok2api-default"],
    )
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("preserves gateway endpoints, credentials, ids, names, and selected models", () => {
    const oldConfig = {
      providersConfig: [
        {
          id: "my-cli",
          name: "Office CLI proxy",
          description: "Shared gateway",
          enabled: false,
          provider: "openai-compatible",
          baseURL: "https://cli.example.com/v1/chat/completions",
          apiKey: "cli-secret",
          headers: { "X-Tenant": "read-frog" },
          model: { model: "use-custom-model", isCustomModel: true, customModel: "gemini-3-pro" },
        },
        {
          id: "my-grok",
          name: "grok2api home",
          enabled: true,
          provider: "open-responses",
          url: "https://grok.example.com:8000/v1/responses/",
          apiKey: "grok-secret",
          model: { model: "grok-4.1", isCustomModel: false, customModel: null },
          reasoning: "high",
        },
      ],
      translate: { providerId: "my-cli" },
    }

    const migrated = migrate(oldConfig)

    expect(migrated.providersConfig).toEqual([
      {
        id: "my-cli",
        name: "Office CLI proxy",
        description: "Shared gateway",
        enabled: true,
        provider: "cli-proxy-api",
        baseURL: "https://cli.example.com/v1/chat/completions",
        apiKey: "cli-secret",
        headers: { "X-Tenant": "read-frog" },
        model: {
          model: "use-custom-model",
          isCustomModel: true,
          customModel: "gemini-3-pro",
        },
        reasoning: "provider-default",
      },
      {
        id: "my-grok",
        name: "grok2api home",
        enabled: true,
        provider: "grok2api",
        baseURL: "https://grok.example.com:8000/v1",
        apiKey: "grok-secret",
        model: { model: "use-custom-model", isCustomModel: true, customModel: "grok-4.1" },
        reasoning: "high",
      },
    ])
    expect(migrated.translate.providerId).toBe("my-cli")
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("recognizes default gateway ports in legacy compatible-provider configs", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "cli-by-port",
          name: "Local proxy",
          enabled: true,
          provider: "openai-compatible",
          baseURL: "http://localhost:8317",
          model: { model: "claude-sonnet-4", isCustomModel: false, customModel: null },
        },
        {
          id: "grok-by-port",
          name: "Local proxy 2",
          enabled: true,
          provider: "openai-compatible",
          baseURL: "http://localhost:8000/v1",
          model: { model: "grok-4", isCustomModel: false, customModel: null },
        },
      ],
    })

    expect(migrated.providersConfig.map((provider: any) => provider.provider)).toEqual([
      "cli-proxy-api",
      "grok2api",
    ])
    expect(migrated.providersConfig.map((provider: any) => provider.id)).toEqual([
      "cli-by-port",
      "grok-by-port",
    ])
  })

  it("leaves malformed values unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ providersConfig: null, translate: { providerId: "old" } })).toEqual({
      providersConfig: null,
      translate: { providerId: "old" },
    })
  })

  it.each(Object.entries(v092TestSeries))(
    "keeps the full %s fixture schema-valid with only the two supported gateways",
    (_seriesId, series) => {
      const migrated = migrate(series.config)
      const parseResult = configSchema.safeParse(migrated)

      expect(parseResult.success).toBe(true)
      expect(migrated.providersConfig.map((provider: any) => provider.provider).sort()).toEqual([
        "cli-proxy-api",
        "grok2api",
      ])
      expect(migrate(migrated)).toEqual(migrated)
    },
  )
})
