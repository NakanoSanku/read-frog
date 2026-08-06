import type {
  LLMProviderConfig,
  ProtocolCompatibleLLMProviderConfig,
} from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import {
  getProviderModelsRequest,
  getProviderModelsURL,
  parseProviderModelsResponse,
} from "../models-url"

const customModel = {
  model: "use-custom-model",
  isCustomModel: true,
  customModel: "test-model",
} as const

const selectedModel = {
  model: "test-model",
  isCustomModel: false,
  customModel: null,
} as const

const openAICompatibleConfig = {
  id: "openai-compatible-test",
  name: "Custom Chat Complete",
  enabled: true,
  provider: "openai-compatible",
  baseURL: "https://example.com/v1/",
  model: customModel,
} satisfies ProtocolCompatibleLLMProviderConfig

const openResponsesConfig = {
  id: "open-responses-test",
  name: "Custom Responses",
  enabled: true,
  provider: "open-responses",
  url: "https://example.com/v1/responses",
  model: customModel,
} satisfies ProtocolCompatibleLLMProviderConfig

describe("getProviderModelsURL", () => {
  it("supports OpenAI-compatible roots and full Responses endpoints", () => {
    expect(getProviderModelsURL(openAICompatibleConfig)).toBe("https://example.com/v1/models")
    expect(getProviderModelsURL(openResponsesConfig)).toBe("https://example.com/v1/models")
  })

  it("preserves endpoint query parameters and removes fragments", () => {
    expect(
      getProviderModelsURL({
        ...openResponsesConfig,
        url: "https://example.com/custom/responses/?api-version=2026-01-01#ignored",
      }),
    ).toBe("https://example.com/custom/models?api-version=2026-01-01")
  })

  it("uses the native Google model endpoint", () => {
    const config = {
      id: "google-test",
      name: "Google",
      enabled: true,
      provider: "google",
      apiKey: "google-key",
      model: selectedModel,
    } satisfies LLMProviderConfig

    expect(getProviderModelsURL(config)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    )
    expect(getProviderModelsRequest(config).init.headers).toMatchObject({
      "x-goog-api-key": "google-key",
    })
  })

  it("uses Anthropic's native authentication and pagination", () => {
    const config = {
      id: "anthropic-test",
      name: "Anthropic",
      enabled: true,
      provider: "anthropic",
      apiKey: "anthropic-key",
      model: selectedModel,
    } satisfies LLMProviderConfig

    expect(getProviderModelsURL(config)).toBe("https://api.anthropic.com/v1/models?limit=1000")
    expect(getProviderModelsRequest(config).init.headers).toMatchObject({
      "anthropic-version": "2023-06-01",
      "x-api-key": "anthropic-key",
    })
  })

  it("uses Azure's v1 models endpoint and api-key header", () => {
    const config = {
      id: "azure-test",
      name: "Azure",
      enabled: true,
      provider: "azure",
      apiKey: "azure-key",
      model: selectedModel,
      providerSpecificSettings: {
        resourceName: "demo",
        apiVersion: "v1",
      },
    } satisfies LLMProviderConfig

    expect(getProviderModelsURL(config)).toBe(
      "https://demo.openai.azure.com/openai/v1/models?api-version=v1",
    )
    expect(getProviderModelsRequest(config).init.headers).toMatchObject({
      "api-key": "azure-key",
    })
  })

  it("uses provider-native endpoints for Bedrock, Cohere, DeepInfra, and Ollama", () => {
    const bedrock = {
      id: "bedrock-test",
      name: "Bedrock",
      enabled: true,
      provider: "bedrock",
      model: selectedModel,
      providerSpecificSettings: { region: "ap-southeast-1" },
    } satisfies LLMProviderConfig
    const cohere = {
      id: "cohere-test",
      name: "Cohere",
      enabled: true,
      provider: "cohere",
      model: selectedModel,
    } satisfies LLMProviderConfig
    const deepinfra = {
      id: "deepinfra-test",
      name: "DeepInfra",
      enabled: true,
      provider: "deepinfra",
      model: selectedModel,
    } satisfies LLMProviderConfig
    const ollama = {
      id: "ollama-test",
      name: "Ollama",
      enabled: true,
      provider: "ollama",
      model: selectedModel,
    } satisfies LLMProviderConfig

    expect(getProviderModelsURL(bedrock)).toBe(
      "https://bedrock.ap-southeast-1.amazonaws.com/foundation-models?byOutputModality=TEXT",
    )
    expect(getProviderModelsURL(cohere)).toBe(
      "https://api.cohere.com/v1/models?endpoint=chat&page_size=1000",
    )
    expect(getProviderModelsURL(deepinfra)).toBe("https://api.deepinfra.com/v1/openai/models")
    expect(getProviderModelsURL(ollama)).toBe("http://127.0.0.1:11434/api/tags")
  })
})

describe("parseProviderModelsResponse", () => {
  it("normalizes OpenAI-compatible and Anthropic data responses", () => {
    expect(
      parseProviderModelsResponse("openai", {
        data: [{ id: "gpt-new" }, { id: "gpt-new" }, { id: "gpt-next" }],
      }),
    ).toEqual(["gpt-new", "gpt-next"])
    expect(parseProviderModelsResponse("anthropic", { data: [{ id: "claude-new" }] })).toEqual([
      "claude-new",
    ])
  })

  it("keeps only Gemini models that support content generation", () => {
    expect(
      parseProviderModelsResponse("google", {
        models: [
          { name: "models/gemini-new", supportedGenerationMethods: ["generateContent"] },
          { name: "models/text-embedding-new", supportedGenerationMethods: ["embedContent"] },
        ],
      }),
    ).toEqual(["gemini-new"])
  })

  it("normalizes Cohere, Ollama, Bedrock, and Replicate responses", () => {
    expect(parseProviderModelsResponse("cohere", { models: [{ name: "command-new" }] })).toEqual([
      "command-new",
    ])
    expect(parseProviderModelsResponse("ollama", { models: [{ model: "llama:new" }] })).toEqual([
      "llama:new",
    ])
    expect(
      parseProviderModelsResponse("bedrock", {
        modelSummaries: [{ modelId: "amazon.nova-new-v1:0" }],
      }),
    ).toEqual(["amazon.nova-new-v1:0"])
    expect(
      parseProviderModelsResponse("replicate", {
        results: [{ owner: "meta", name: "llama-new" }],
      }),
    ).toEqual(["meta/llama-new"])
  })
})
