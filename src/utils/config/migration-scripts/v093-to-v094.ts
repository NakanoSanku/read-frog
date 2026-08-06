/**
 * Rollback bridge from v093 to v094.
 *
 * Configs already touched by v1.47.0 can contain CLIProxyAPI and grok2api
 * provider discriminators that the restored v1.46.3 schema does not know.
 * Convert those entries to the equivalent OpenAI-compatible provider while
 * preserving their ids, endpoints, credentials, model selections, and all
 * feature assignments that reference those ids.
 *
 * IMPORTANT: This is a frozen snapshot. Keep all values and helpers inline.
 */

const GATEWAY_PROVIDERS = new Set(["cli-proxy-api", "grok2api"])

function isRecord(value: any): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function convertGatewayProvider(provider: any): any {
  const converted: any = {
    id: provider.id,
    name: provider.name,
    enabled: provider.enabled,
    provider: "openai-compatible",
    baseURL: provider.baseURL,
    model: provider.model,
  }

  for (const key of ["description", "apiKey", "temperature", "providerOptions", "headers"]) {
    if (provider[key] !== undefined) converted[key] = provider[key]
  }

  return converted
}

export function migrate(oldConfig: any): any {
  if (!isRecord(oldConfig) || !Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }

  let changed = false
  const providersConfig = oldConfig.providersConfig.map((provider: any) => {
    if (!isRecord(provider) || !GATEWAY_PROVIDERS.has(provider.provider)) {
      return provider
    }

    changed = true
    return convertGatewayProvider(provider)
  })

  return changed ? { ...oldConfig, providersConfig } : oldConfig
}
