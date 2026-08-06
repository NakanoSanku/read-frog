import type { APIProviderConfig } from "@/types/config/provider"
import { useSelector } from "@tanstack/react-store"
import { isLLMProviderConfig } from "@/types/config/provider"
import { i18n } from "@/utils/i18n"
import { resolveModelId } from "@/utils/providers/model-id"
import { ModelSuggestionButton } from "./components/model-suggestion-button"
import { ProviderOptionsRecommendationTrigger } from "./components/provider-options-recommendation-trigger"
import { withForm } from "./form"

export const TranslateModelSelector = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useSelector(form.store, (state) => state.values)
    if (!isLLMProviderConfig(providerConfig)) return null

    const modelId = resolveModelId(providerConfig.model)
    const { isCustomModel, customModel, model } = providerConfig.model

    const applyRecommendedProviderOptions = (options: Record<string, unknown>) => {
      form.setFieldValue("providerOptions", options)
      void form.handleSubmit()
    }

    const recommendationTrigger = (
      <ProviderOptionsRecommendationTrigger
        providerId={providerConfig.id}
        modelId={modelId}
        currentProviderOptions={providerConfig.providerOptions}
        onApply={applyRecommendedProviderOptions}
      />
    )

    return (
      <div>
        {isCustomModel ? (
          <form.AppField name="model.customModel">
            {(field) => (
              <field.InputFieldAutoSave
                formForSubmit={form}
                label={i18n.t("options.apiProviders.form.models.label")}
                labelExtra={
                  <div className="flex items-center gap-2">
                    {recommendationTrigger}
                    <ModelSuggestionButton
                      providerConfig={providerConfig}
                      onSelect={(selectedModel) => {
                        field.handleChange(selectedModel)
                        void form.handleSubmit()
                      }}
                    />
                  </div>
                }
                value={customModel ?? ""}
              />
            )}
          </form.AppField>
        ) : (
          <form.AppField name="model.model">
            {(field) => (
              <field.InputFieldAutoSave
                formForSubmit={form}
                label={i18n.t("options.apiProviders.form.models.label")}
                labelExtra={
                  <div className="flex items-center gap-2">
                    {recommendationTrigger}
                    <ModelSuggestionButton
                      providerConfig={providerConfig}
                      onSelect={(selectedModel) => {
                        field.handleChange(selectedModel)
                        void form.handleSubmit()
                      }}
                    />
                  </div>
                }
                placeholder={i18n.t("options.apiProviders.form.models.translate.placeholder")}
                value={model}
              />
            )}
          </form.AppField>
        )}
      </div>
    )
  },
})
