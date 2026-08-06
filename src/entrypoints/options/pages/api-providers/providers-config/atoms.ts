import { atom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getAPIProvidersConfig } from "@/utils/config/helpers"

const internalSelectedProviderIdAtom = atom<string | undefined>(undefined)

export const selectedProviderIdAtom = atom(
  (get) => {
    const selected = get(internalSelectedProviderIdAtom)
    if (selected !== undefined) {
      return selected
    }

    const providersConfig = get(configFieldsAtomMap.providersConfig)
    const apiProvidersConfig = getAPIProvidersConfig(providersConfig)
    return apiProvidersConfig[0]?.id
  },
  (_get, set, newValue: string | undefined) => {
    set(internalSelectedProviderIdAtom, newValue)
  },
)
