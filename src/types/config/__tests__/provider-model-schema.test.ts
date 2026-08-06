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

  it("still requires custom model mode for custom protocol providers", () => {
    const result = apiProviderConfigItemSchema.safeParse({
      id: "custom-test",
      name: "Custom",
      enabled: true,
      provider: "openai-compatible",
      baseURL: "https://example.com/v1",
      model: {
        model: "future-model-from-api",
        isCustomModel: false,
        customModel: null,
      },
    })

    expect(result.success).toBe(false)
  })
})
