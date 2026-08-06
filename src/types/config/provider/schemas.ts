import type {
  APIProviderTypes,
  DedicatedLLMProviderTypes,
  LLMProviderTypes,
  NonAPIProviderTypes,
  OpenAICompatibleLLMProviderTypes,
  OpenResponsesLLMProviderTypes,
  ProtocolCompatibleLLMProviderTypes,
  PureAPIProviderTypes,
  TopLevelReasoningProviderTypes,
  TranslateProviderTypes,
} from "./constants"
import { z } from "zod"
import { AI_SDK_REASONING_VALUES, isCustomModelOnlyProvider } from "./constants"
import {
  azureProviderSpecificSettingsSchema,
  bedrockProviderSpecificSettingsSchema,
} from "./provider-specific-settings"

export const providerSponsorConfigSchema = z.object({
  sponsoring: z.boolean(),
  referUrl: z.url(),
})
export type ProviderSponsorConfig = z.infer<typeof providerSponsorConfigSchema>

/* ──────────────────────────────
  Providers config schema
  ────────────────────────────── */

export const llmProviderModelSchema = z.object({
  model: z.string().trim().min(1),
  isCustomModel: z.boolean(),
  customModel: z.string().nullable(),
})
export type LLMProviderModel = z.infer<typeof llmProviderModelSchema>

// Keep the legacy model shape so existing configs remain compatible, but accept
// every model id returned by provider APIs instead of validating against a local catalog.
function createProviderModelSchema(provider: LLMProviderTypes) {
  return llmProviderModelSchema.extend({
    isCustomModel: isCustomModelOnlyProvider(provider) ? z.literal(true) : z.boolean(),
  })
}

// Base schema without models
export const baseProviderConfigSchema = z.strictObject({
  id: z.string().nonempty(),
  name: z.string().nonempty(),
  description: z.string().optional(),
  enabled: z.boolean(),
})

export const baseAPIProviderConfigSchema = baseProviderConfigSchema.extend({
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  temperature: z.number().min(0).optional(),
  providerOptions: z.record(z.string(), z.any()).optional(),
  headers: z.record(z.string(), z.any()).optional(),
})

export const baseOpenAICompatibleLLMProviderConfigSchema = baseAPIProviderConfigSchema.extend({
  baseURL: z.string(),
})

export const baseOpenResponsesLLMProviderConfigSchema = baseAPIProviderConfigSchema
  .omit({ baseURL: true })
  .extend({
    url: z.string(),
  })

const topLevelReasoningConfigSchema = {
  reasoning: z.enum(AI_SDK_REASONING_VALUES).optional(),
}

const llmProviderConfigSchemaList = [
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("cli-proxy-api"),
    model: createProviderModelSchema("cli-proxy-api"),
    ...topLevelReasoningConfigSchema,
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("grok2api"),
    model: createProviderModelSchema("grok2api"),
    ...topLevelReasoningConfigSchema,
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("atlascloud"),
    model: createProviderModelSchema("atlascloud"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("siliconflow"),
    model: createProviderModelSchema("siliconflow"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("tensdaq"),
    model: createProviderModelSchema("tensdaq"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("volcengine"),
    model: createProviderModelSchema("volcengine"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("openai-compatible"),
    model: createProviderModelSchema("openai-compatible"),
  }),
  baseOpenResponsesLLMProviderConfigSchema.extend({
    provider: z.literal("open-responses"),
    model: createProviderModelSchema("open-responses"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("openrouter"),
    model: createProviderModelSchema("openrouter"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("minimax"),
    model: createProviderModelSchema("minimax"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("openai"),
    model: createProviderModelSchema("openai"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("azure"),
    model: createProviderModelSchema("azure"),
    providerSpecificSettings: azureProviderSpecificSettingsSchema.optional(),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("deepseek"),
    model: createProviderModelSchema("deepseek"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("google"),
    model: createProviderModelSchema("google"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("anthropic"),
    model: createProviderModelSchema("anthropic"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("xai"),
    model: createProviderModelSchema("xai"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("bedrock"),
    model: createProviderModelSchema("bedrock"),
    providerSpecificSettings: bedrockProviderSpecificSettingsSchema,
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("groq"),
    model: createProviderModelSchema("groq"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("deepinfra"),
    model: createProviderModelSchema("deepinfra"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("mistral"),
    model: createProviderModelSchema("mistral"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("togetherai"),
    model: createProviderModelSchema("togetherai"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("cohere"),
    model: createProviderModelSchema("cohere"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("fireworks"),
    model: createProviderModelSchema("fireworks"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("cerebras"),
    model: createProviderModelSchema("cerebras"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("replicate"),
    model: createProviderModelSchema("replicate"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("perplexity"),
    model: createProviderModelSchema("perplexity"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("vercel"),
    model: createProviderModelSchema("vercel"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("ollama"),
    model: createProviderModelSchema("ollama"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("alibaba"),
    model: createProviderModelSchema("alibaba"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("moonshotai"),
    model: createProviderModelSchema("moonshotai"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("huggingface"),
    model: createProviderModelSchema("huggingface"),
  }),
] as const

const apiProviderConfigSchemaList = [
  ...llmProviderConfigSchemaList,
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("deeplx"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("deepl"),
  }),
] as const

export const providerConfigSchemaList = [
  ...apiProviderConfigSchemaList,
  baseProviderConfigSchema.extend({
    provider: z.literal("google-translate"),
  }),
  baseProviderConfigSchema.extend({
    provider: z.literal("microsoft-translate"),
  }),
] as const

export const llmProviderConfigItemSchema = z.discriminatedUnion(
  "provider",
  llmProviderConfigSchemaList,
)
export const apiProviderConfigItemSchema = z.discriminatedUnion(
  "provider",
  apiProviderConfigSchemaList,
)
export const providerConfigItemSchema = z.discriminatedUnion("provider", providerConfigSchemaList)

export const providersConfigSchema = z
  .array(providerConfigItemSchema)
  .superRefine((providers, ctx) => {
    const idSet = new Set<string>()
    providers.forEach((provider, index) => {
      if (idSet.has(provider.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate provider id "${provider.id}"`,
          path: [index, "id"],
        })
      }
      idSet.add(provider.id)
    })

    const nameSet = new Set<string>()
    providers.forEach((provider, index) => {
      if (nameSet.has(provider.name)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate provider name "${provider.name}"`,
          path: [index, "name"],
        })
      }
      nameSet.add(provider.name)
    })
  })
export type ProvidersConfig = z.infer<typeof providersConfigSchema>
export type ProviderConfig = ProvidersConfig[number]
export type NonAPIProviderConfig = Extract<ProviderConfig, { provider: NonAPIProviderTypes }>
export type PureProviderConfig = Extract<ProviderConfig, { provider: PureAPIProviderTypes }>
export type APIProviderConfig = Extract<ProviderConfig, { provider: APIProviderTypes }>
export type PureAPIProviderConfig = Extract<ProviderConfig, { provider: PureAPIProviderTypes }>
export type LLMProviderConfig = Extract<ProviderConfig, { provider: LLMProviderTypes }>
export type TranslateProviderConfig = Extract<ProviderConfig, { provider: TranslateProviderTypes }>
export type OpenAICompatibleLLMProviderConfig = Extract<
  ProviderConfig,
  { provider: OpenAICompatibleLLMProviderTypes }
>
export type OpenResponsesLLMProviderConfig = Extract<
  ProviderConfig,
  { provider: OpenResponsesLLMProviderTypes }
>
export type ProtocolCompatibleLLMProviderConfig = Extract<
  ProviderConfig,
  { provider: ProtocolCompatibleLLMProviderTypes }
>
export type DedicatedLLMProviderConfig = Extract<
  ProviderConfig,
  { provider: DedicatedLLMProviderTypes }
>
export type TopLevelReasoningProviderConfig = Extract<
  LLMProviderConfig,
  { provider: TopLevelReasoningProviderTypes }
>

export type LLMProviderModels = Record<LLMProviderTypes, LLMProviderModel>
