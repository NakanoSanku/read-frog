import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v092-to-v093"

describe("migration v092 to v093", () => {
  it("preserves v092 configs unchanged during the rollback upgrade", () => {
    const oldConfig = {
      providersConfig: [
        {
          id: "openai-default",
          name: "OpenAI",
          enabled: true,
          provider: "openai",
        },
      ],
      translate: { providerId: "openai-default" },
    }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })
})
