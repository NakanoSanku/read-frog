import type { TTSEngine } from "@/types/config/tts"
import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

function getEngineLabel(engine: TTSEngine): string {
  return engine === "google-translate"
    ? i18n.t("options.tts.engine.googleTranslate")
    : i18n.t("options.tts.engine.edgeTts")
}

export function EngineSection() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <ConfigSection id="engine" title={i18n.t("options.tts.engine.title")}>
      <ConfigItem
        id="tts-engine"
        title={i18n.t("options.tts.engine.selector.title")}
        description={i18n.t("options.tts.engine.selector.description")}
      >
        <Select
          value={ttsConfig.engine}
          onValueChange={(engine) => {
            void setTtsConfig({ engine: engine as TTSEngine })
          }}
        >
          <SelectTrigger size="sm">
            <SelectValue render={<span />}>{getEngineLabel(ttsConfig.engine)}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              <SelectItem value="edge-tts">{getEngineLabel("edge-tts")}</SelectItem>
              <SelectItem value="google-translate">{getEngineLabel("google-translate")}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </ConfigItem>
    </ConfigSection>
  )
}
