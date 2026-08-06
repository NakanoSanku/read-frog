import type {
  APIProviderConfig,
  ProtocolCompatibleLLMProviderConfig,
} from "@/types/config/provider"
import { isOpenResponsesLLMProviderConfig } from "@/types/config/provider"

const GATEWAY_PROVIDER_TYPES = new Set(["cli-proxy-api", "grok2api"])

/** Accept a gateway root, an API base, or a concrete OpenAI endpoint. */
function normalizeGatewayBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim()
  if (!trimmed) return trimmed

  try {
    const url = new URL(trimmed)
    let pathname = url.pathname.replace(/\/+$/, "")
    pathname = pathname.replace(/\/v1\/(?:chat\/completions|responses|models)$/i, "/v1")
    if (!pathname.toLowerCase().endsWith("/v1")) {
      pathname = `${pathname}/v1`
    }
    url.pathname = pathname.replace(/^\/?/, "/")
    url.hash = ""
    return url.toString()
  } catch {
    return trimmed
  }
}

/** Return the configured endpoint used to connect to an API provider. */
export function getProviderConnectionURL(
  providerConfig: ProtocolCompatibleLLMProviderConfig,
): string
export function getProviderConnectionURL(providerConfig: APIProviderConfig): string | undefined
export function getProviderConnectionURL(providerConfig: APIProviderConfig): string | undefined {
  const connectionURL = isOpenResponsesLLMProviderConfig(providerConfig)
    ? providerConfig.url
    : providerConfig.baseURL

  return connectionURL && GATEWAY_PROVIDER_TYPES.has(providerConfig.provider)
    ? normalizeGatewayBaseURL(connectionURL)
    : connectionURL
}
