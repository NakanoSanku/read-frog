import { describe, expect, it } from "vitest"
import { apiProviderConfigItemSchema } from "../provider"

describe("provider model schema", () => {
  it("accepts model ids discovered at runtime", () => {
    const result = apiProviderConfigItemSchema.safeParse({
      id: "openai-test",
      name: "OpenAI",
      enabled: true,
      provider: "openai",
      model: {
        model: "future-model-from-api",
        isCustomModel: false,
        customModel: null,
      },
    })

    expect(result.success).toBe(true)
  })

  it.each(["openai-compatible", "open-responses", "cli-proxy-api", "grok2api"] as const)(
    "requires custom model mode for %s",
    (provider) => {
      const result = apiProviderConfigItemSchema.safeParse({
        id: `${provider}-test`,
        name: provider,
        enabled: true,
        provider,
        ...(provider === "open-responses"
          ? { url: "https://example.com/v1/responses" }
          : { baseURL: "https://example.com/v1" }),
        model: {
          model: "future-model-from-api",
          isCustomModel: false,
          customModel: null,
        },
      })

      expect(result.success).toBe(false)
    },
  )
})
