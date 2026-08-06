/**
 * Migration script from v092 to v093.
 *
 * This distribution now exposes only CLIProxyAPI and grok2api. Existing
 * configurations that already point at either gateway keep their endpoint,
 * credentials, selected model, and id. All other providers are removed and
 * feature assignments are moved to the closest gateway.
 *
 * IMPORTANT: Every value and helper is frozen inline. Migration scripts must
 * not import constants or utilities from the evolving application code.
 */

const CLI_PROXY_API = "cli-proxy-api"
const GROK2API = "grok2api"

const DEFAULT_BASE_URLS = {
  [CLI_PROXY_API]: "http://127.0.0.1:8317/v1",
  [GROK2API]: "http://127.0.0.1:8000/v1",
} as const

const DEFAULT_NAMES = {
  [CLI_PROXY_API]: "CLIProxyAPI",
  [GROK2API]: "grok2api",
} as const

const DEFAULT_IDS = {
  [CLI_PROXY_API]: "cli-proxy-api-default",
  [GROK2API]: "grok2api-default",
} as const

const REASONING_VALUES = new Set([
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
])

function isRecord(value: any): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function providerFingerprint(provider: any): string {
  return [
    provider?.provider,
    provider?.name,
    provider?.description,
    provider?.baseURL,
    provider?.url,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase()
}

function classifyGateway(provider: any): typeof CLI_PROXY_API | typeof GROK2API | null {
  if (!isRecord(provider)) return null
  if (provider.provider === CLI_PROXY_API || provider.provider === GROK2API) {
    return provider.provider
  }

  const fingerprint = providerFingerprint(provider)
  if (
    fingerprint.includes("grok2api") ||
    fingerprint.includes("grok-2-api") ||
    /:8000(?:\/|\s|$)/.test(fingerprint)
  ) {
    return GROK2API
  }
  if (
    fingerprint.includes("cliproxyapi") ||
    fingerprint.includes("cli-proxy-api") ||
    fingerprint.includes("cli proxy api") ||
    fingerprint.includes("cli-proxy") ||
    fingerprint.includes("cli proxy") ||
    /:8317(?:\/|\s|$)/.test(fingerprint)
  ) {
    return CLI_PROXY_API
  }
  return null
}

function responsesURLToBaseURL(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/responses$/i, "")
}

function resolveExistingModel(model: any): string | null {
  if (!isRecord(model)) return null
  const candidate = model.isCustomModel ? model.customModel : model.model
  if (typeof candidate !== "string") return null
  const trimmed = candidate.trim()
  return trimmed && trimmed !== "use-custom-model" ? trimmed : null
}

function migrateGatewayProvider(
  provider: any,
  target: typeof CLI_PROXY_API | typeof GROK2API,
): any {
  const baseURLCandidate =
    typeof provider.baseURL === "string"
      ? provider.baseURL.trim()
      : typeof provider.url === "string"
        ? responsesURLToBaseURL(provider.url)
        : ""
  const migrated: any = {
    id: typeof provider.id === "string" && provider.id ? provider.id : DEFAULT_IDS[target],
    name:
      typeof provider.name === "string" && provider.name ? provider.name : DEFAULT_NAMES[target],
    enabled: typeof provider.enabled === "boolean" ? provider.enabled : true,
    provider: target,
    baseURL: baseURLCandidate || DEFAULT_BASE_URLS[target],
    model: {
      model: "use-custom-model",
      isCustomModel: true,
      customModel: resolveExistingModel(provider.model),
    },
    reasoning: REASONING_VALUES.has(provider.reasoning) ? provider.reasoning : "provider-default",
  }

  for (const key of ["description", "apiKey", "temperature", "providerOptions", "headers"]) {
    if (provider[key] !== undefined) migrated[key] = provider[key]
  }

  return migrated
}

function nextUniqueValue(preferred: string, usedValues: Set<string>): string {
  if (!usedValues.has(preferred)) {
    usedValues.add(preferred)
    return preferred
  }

  let suffix = 2
  while (usedValues.has(`${preferred}-${suffix}`)) suffix += 1
  const value = `${preferred}-${suffix}`
  usedValues.add(value)
  return value
}

function createDefaultProvider(
  target: typeof CLI_PROXY_API | typeof GROK2API,
  usedIds: Set<string>,
  usedNames: Set<string>,
): any {
  return {
    id: nextUniqueValue(DEFAULT_IDS[target], usedIds),
    name: nextUniqueValue(DEFAULT_NAMES[target], usedNames),
    enabled: true,
    provider: target,
    baseURL: DEFAULT_BASE_URLS[target],
    model: {
      model: "use-custom-model",
      isCustomModel: true,
      customModel: null,
    },
    reasoning: "provider-default",
  }
}

function ensureEnabledPrimary(providers: any[]): { providers: any[]; primaryId: string } {
  const enabled = providers.find((provider) => provider.enabled)
  if (enabled) return { providers, primaryId: enabled.id }

  const [first, ...rest] = providers
  const enabledFirst = { ...first, enabled: true }
  return { providers: [enabledFirst, ...rest], primaryId: enabledFirst.id }
}

function migrateProviderIdContainer(value: any, resolveProviderId: (id: string) => string): any {
  if (!isRecord(value) || typeof value.providerId !== "string") return value
  const providerId = resolveProviderId(value.providerId)
  return providerId === value.providerId ? value : { ...value, providerId }
}

export function migrate(oldConfig: any): any {
  if (!isRecord(oldConfig) || !Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }

  const originalProviders = oldConfig.providersConfig.filter(isRecord)
  const migratedProviders = originalProviders.flatMap((provider) => {
    const target = classifyGateway(provider)
    return target ? [migrateGatewayProvider(provider, target)] : []
  })

  const usedIds = new Set(migratedProviders.map((provider) => provider.id))
  const usedNames = new Set(migratedProviders.map((provider) => provider.name))
  let cliProviders = migratedProviders.filter((provider) => provider.provider === CLI_PROXY_API)
  let grokProviders = migratedProviders.filter((provider) => provider.provider === GROK2API)

  if (cliProviders.length === 0) {
    cliProviders = [createDefaultProvider(CLI_PROXY_API, usedIds, usedNames)]
  }
  if (grokProviders.length === 0) {
    grokProviders = [createDefaultProvider(GROK2API, usedIds, usedNames)]
  }

  const cliResult = ensureEnabledPrimary(cliProviders)
  const grokResult = ensureEnabledPrimary(grokProviders)
  const providersConfig = [...cliResult.providers, ...grokResult.providers]
  const keptIds = new Set(providersConfig.map((provider) => provider.id))
  const originalProvidersById = new Map(
    originalProviders
      .filter((provider) => typeof provider.id === "string")
      .map((provider) => [provider.id, provider]),
  )

  const resolveProviderId = (providerId: string): string => {
    if (keptIds.has(providerId)) return providerId
    const previousProvider = originalProvidersById.get(providerId)
    const fingerprint = providerFingerprint(previousProvider)
    return previousProvider?.provider === "xai" || fingerprint.includes("grok")
      ? grokResult.primaryId
      : cliResult.primaryId
  }

  const translate = migrateProviderIdContainer(oldConfig.translate, resolveProviderId)
  const inputTranslation = migrateProviderIdContainer(oldConfig.inputTranslation, resolveProviderId)
  const videoSubtitles = migrateProviderIdContainer(oldConfig.videoSubtitles, resolveProviderId)
  const languageDetection = isRecord(oldConfig.languageDetection)
    ? migrateProviderIdContainer(
        oldConfig.languageDetection.mode === "llm" &&
          typeof oldConfig.languageDetection.providerId !== "string"
          ? { ...oldConfig.languageDetection, providerId: cliResult.primaryId }
          : oldConfig.languageDetection,
        resolveProviderId,
      )
    : oldConfig.languageDetection

  let selectionToolbar = oldConfig.selectionToolbar
  if (isRecord(selectionToolbar)) {
    const features = isRecord(selectionToolbar.features)
      ? {
          ...selectionToolbar.features,
          translate: migrateProviderIdContainer(
            selectionToolbar.features.translate,
            resolveProviderId,
          ),
        }
      : selectionToolbar.features
    const builtInActions = isRecord(selectionToolbar.builtInActions)
      ? {
          ...selectionToolbar.builtInActions,
          dictionary: migrateProviderIdContainer(
            selectionToolbar.builtInActions.dictionary,
            resolveProviderId,
          ),
        }
      : selectionToolbar.builtInActions
    const customActions = Array.isArray(selectionToolbar.customActions)
      ? selectionToolbar.customActions.map((action: any) =>
          migrateProviderIdContainer(action, resolveProviderId),
        )
      : selectionToolbar.customActions

    selectionToolbar = {
      ...selectionToolbar,
      features,
      builtInActions,
      customActions,
    }
  }

  return {
    ...oldConfig,
    providersConfig,
    translate,
    inputTranslation,
    videoSubtitles,
    languageDetection,
    selectionToolbar,
  }
}
