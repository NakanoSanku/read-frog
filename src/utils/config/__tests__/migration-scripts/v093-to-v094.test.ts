import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrate } from "../../migration-scripts/v093-to-v094"
import { testSeries as v093TestSeries } from "../example/v093"

describe("migration v093 to v094", () => {
  it("converts both v1.47 gateway providers without changing their ids or assignments", () => {
    const oldConfig = {
      providersConfig: [
        {
          id: "cli-live",
          name: "CLIProxyAPI",
          description: "Local CLI gateway",
          enabled: true,
          provider: "cli-proxy-api",
          baseURL: "http://127.0.0.1:8317/v1",
          apiKey: "cli-key",
          model: {
            model: "use-custom-model",
            isCustomModel: true,
            customModel: "cli-model",
          },
          reasoning: "high",
          temperature: 0.2,
          headers: { "X-Test": "cli" },
        },
        {
          id: "grok-live",
          name: "grok2api",
          enabled: true,
          provider: "grok2api",
          baseURL: "http://127.0.0.1:8000/v1",
          apiKey: "grok-key",
          model: {
            model: "use-custom-model",
            isCustomModel: true,
            customModel: "grok-model",
          },
          reasoning: "provider-default",
          providerOptions: { grok: { enabled: true } },
        },
      ],
      translate: { providerId: "cli-live" },
      inputTranslation: { providerId: "grok-live" },
      selectionToolbar: {
        customActions: [{ id: "explain", providerId: "cli-live" }],
      },
    }

    const migrated = migrate(oldConfig)

    expect(migrated.providersConfig).toEqual([
      {
        id: "cli-live",
        name: "CLIProxyAPI",
        description: "Local CLI gateway",
        enabled: true,
        provider: "openai-compatible",
        baseURL: "http://127.0.0.1:8317/v1",
        apiKey: "cli-key",
        model: {
          model: "use-custom-model",
          isCustomModel: true,
          customModel: "cli-model",
        },
        temperature: 0.2,
        headers: { "X-Test": "cli" },
      },
      {
        id: "grok-live",
        name: "grok2api",
        enabled: true,
        provider: "openai-compatible",
        baseURL: "http://127.0.0.1:8000/v1",
        apiKey: "grok-key",
        model: {
          model: "use-custom-model",
          isCustomModel: true,
          customModel: "grok-model",
        },
        providerOptions: { grok: { enabled: true } },
      },
    ])
    expect(migrated.translate.providerId).toBe("cli-live")
    expect(migrated.inputTranslation.providerId).toBe("grok-live")
    expect(migrated.selectionToolbar.customActions[0].providerId).toBe("cli-live")
    expect(oldConfig.providersConfig[0]).toHaveProperty("provider", "cli-proxy-api")
  })

  it("is idempotent and leaves restored provider configs untouched", () => {
    const config = {
      providersConfig: [
        {
          id: "custom",
          name: "Custom",
          enabled: true,
          provider: "openai-compatible",
        },
      ],
    }

    expect(migrate(config)).toBe(config)
    expect(migrate(migrate(config))).toBe(config)
  })

  it("produces a config accepted by the restored provider schema", () => {
    const config = structuredClone(v093TestSeries["complex-config-from-v020"]!.config)
    config.providersConfig = config.providersConfig.map((provider: any) =>
      provider.id === "openai-default"
        ? {
            id: "openai-default",
            name: "CLIProxyAPI",
            enabled: true,
            provider: "cli-proxy-api",
            baseURL: "http://127.0.0.1:8317/v1",
            model: {
              model: "use-custom-model",
              isCustomModel: true,
              customModel: "cli-model",
            },
            reasoning: "provider-default",
          }
        : provider,
    )

    const parseResult = configSchema.safeParse(migrate(config))
    if (!parseResult.success) throw new Error(JSON.stringify(parseResult.error.issues))
    expect(parseResult.success).toBe(true)
  })

  it("leaves malformed config containers untouched", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate({ providersConfig: null })).toEqual({ providersConfig: null })
  })
})
