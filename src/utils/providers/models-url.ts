import type { LLMProviderConfig, LLMProviderTypes } from "@/types/config/provider"
import { isOpenResponsesLLMProviderConfig } from "@/types/config/provider"
import { PROVIDER_URL_PLACEHOLDERS } from "@/utils/constants/providers"
import { getProviderConnectionURL } from "./connection-url"
import { getProviderHeadersWithOverride } from "./headers"

export interface ProviderModelsRequest {
  url: string
  init: RequestInit
}

function appendPath(url: URL, path: string): void {
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
}

function replaceLastPathSegment(url: URL, segment: string): void {
  const pathname = url.pathname.replace(/\/+$/, "")
  const parentPath = pathname.slice(0, pathname.lastIndexOf("/"))
  url.pathname = `${parentPath}/${segment}`
}

function getAzureBaseURL(providerConfig: LLMProviderConfig): string | undefined {
  if (providerConfig.provider !== "azure") return undefined

  const resourceName = providerConfig.providerSpecificSettings?.resourceName?.trim()
  return resourceName ? `https://${resourceName}.openai.azure.com/openai` : undefined
}

function getBedrockBaseURL(providerConfig: LLMProviderConfig): string | undefined {
  if (providerConfig.provider !== "bedrock") return undefined

  const region = providerConfig.providerSpecificSettings.region.trim()
  return region ? `https://bedrock.${region}.amazonaws.com` : undefined
}

function getProviderModelsBaseURL(providerConfig: LLMProviderConfig): string {
  const configuredURL = getProviderConnectionURL(providerConfig)
  const fallbackURL =
    getAzureBaseURL(providerConfig) ??
    getBedrockBaseURL(providerConfig) ??
    PROVIDER_URL_PLACEHOLDERS[providerConfig.provider]
  const baseURL = configuredURL?.trim() || fallbackURL

  if (!baseURL || baseURL.includes("<resource>")) {
    throw new Error(`Configure a base URL for ${providerConfig.name} before fetching models`)
  }

  return baseURL
}

/** Build the provider-native endpoint used to discover available models. */
export function getProviderModelsURL(providerConfig: LLMProviderConfig): string {
  const url = new URL(getProviderModelsBaseURL(providerConfig))

  switch (providerConfig.provider) {
    case "open-responses": {
      if (isOpenResponsesLLMProviderConfig(providerConfig)) {
        replaceLastPathSegment(url, "models")
      }
      break
    }
    case "azure": {
      const path = url.pathname.replace(/\/+$/, "")
      if (path.endsWith("/openai")) {
        appendPath(url, "v1/models")
      } else {
        appendPath(url, "models")
      }
      url.searchParams.set(
        "api-version",
        providerConfig.providerSpecificSettings?.apiVersion?.trim() || "v1",
      )
      break
    }
    case "bedrock": {
      url.hostname = url.hostname.replace(/^bedrock-runtime\./, "bedrock.")
      url.pathname = "/foundation-models"
      url.search = ""
      url.searchParams.set("byOutputModality", "TEXT")
      break
    }
    case "cohere": {
      const path = url.pathname.replace(/\/+$/, "")
      url.pathname = /\/v[12]$/.test(path) ? path.replace(/\/v[12]$/, "/v1/models") : path
      if (url.pathname === path) appendPath(url, "models")
      url.searchParams.set("endpoint", "chat")
      url.searchParams.set("page_size", "1000")
      break
    }
    case "deepinfra": {
      const path = url.pathname.replace(/\/+$/, "")
      appendPath(url, path.endsWith("/openai") ? "models" : "openai/models")
      break
    }
    case "google": {
      appendPath(url, "models")
      url.searchParams.set("pageSize", "1000")
      break
    }
    case "anthropic": {
      appendPath(url, "models")
      url.searchParams.set("limit", "1000")
      break
    }
    case "ollama": {
      appendPath(url, url.pathname.replace(/\/+$/, "").endsWith("/api") ? "tags" : "api/tags")
      break
    }
    default: {
      appendPath(url, "models")
    }
  }

  url.hash = ""
  return url.toString()
}

function getAuthenticationHeaders(providerConfig: LLMProviderConfig): Record<string, string> {
  const apiKey = providerConfig.apiKey?.trim()
  if (!apiKey) return {}

  switch (providerConfig.provider) {
    case "google":
      return { "x-goog-api-key": apiKey }
    case "anthropic":
      return { "x-api-key": apiKey }
    case "azure":
      return { "api-key": apiKey }
    default:
      return { Authorization: `Bearer ${apiKey}` }
  }
}

/** Build a model-discovery request with each provider's native authentication scheme. */
export function getProviderModelsRequest(providerConfig: LLMProviderConfig): ProviderModelsRequest {
  const providerHeaders = getProviderHeadersWithOverride(
    providerConfig.provider,
    providerConfig.headers,
  )
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...getAuthenticationHeaders(providerConfig),
    ...(providerConfig.provider === "anthropic" && { "anthropic-version": "2023-06-01" }),
    ...providerHeaders,
  }

  return {
    url: getProviderModelsURL(providerConfig),
    init: { headers },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getArray(value: unknown, key: string): unknown[] {
  return isRecord(value) && Array.isArray(value[key]) ? value[key] : []
}

function getString(value: unknown, key: string): string | undefined {
  const candidate = isRecord(value) ? value[key] : undefined
  return typeof candidate === "string" ? candidate : undefined
}

function getGenericModelID(value: unknown): string | undefined {
  if (typeof value === "string") return value
  return getString(value, "id") ?? getString(value, "model") ?? getString(value, "name")
}

function uniqueModelIDs(modelIDs: Array<string | undefined>): string[] {
  return [...new Set(modelIDs.map((modelID) => modelID?.trim()).filter(Boolean) as string[])]
}

/** Normalize provider-specific model-list responses into model IDs used by the form. */
export function parseProviderModelsResponse(
  provider: LLMProviderTypes,
  response: unknown,
): string[] {
  switch (provider) {
    case "google":
      return uniqueModelIDs(
        getArray(response, "models")
          .filter((model) => {
            if (!isRecord(model) || !Array.isArray(model.supportedGenerationMethods)) return true
            return model.supportedGenerationMethods.includes("generateContent")
          })
          .map((model) => getString(model, "name")?.replace(/^models\//, "")),
      )
    case "cohere":
      return uniqueModelIDs(getArray(response, "models").map((model) => getString(model, "name")))
    case "ollama":
      return uniqueModelIDs(
        getArray(response, "models").map(
          (model) => getString(model, "model") ?? getString(model, "name"),
        ),
      )
    case "bedrock":
      return uniqueModelIDs(
        getArray(response, "modelSummaries").map((model) => getString(model, "modelId")),
      )
    case "replicate":
      return uniqueModelIDs(
        getArray(response, "results").map((model) => {
          const owner = getString(model, "owner")
          const name = getString(model, "name")
          return owner && name ? `${owner}/${name}` : getGenericModelID(model)
        }),
      )
    default:
      return uniqueModelIDs(getArray(response, "data").map(getGenericModelID))
  }
}
