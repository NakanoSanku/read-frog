import { describe, expect, it } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { getProviderConnectionURL } from "../connection-url"

describe("getProviderConnectionURL", () => {
  it("reads the full endpoint from an Open Responses config", () => {
    expect(getProviderConnectionURL(DEFAULT_PROVIDER_CONFIG["open-responses"])).toBe(
      "https://api.example.com/v1/responses",
    )
  })

  it("reads the Base URL from other API provider configs", () => {
    expect(getProviderConnectionURL(DEFAULT_PROVIDER_CONFIG["openai-compatible"])).toBe(
      "https://api.example.com/v1",
    )
    expect(getProviderConnectionURL(DEFAULT_PROVIDER_CONFIG.openai)).toBeUndefined()
  })

  it("normalizes CLIProxyAPI roots and concrete endpoints to a v1 API base", () => {
    expect(
      getProviderConnectionURL({
        ...DEFAULT_PROVIDER_CONFIG["cli-proxy-api"],
        baseURL: "http://127.0.0.1:8317",
      }),
    ).toBe("http://127.0.0.1:8317/v1")
    expect(
      getProviderConnectionURL({
        ...DEFAULT_PROVIDER_CONFIG["cli-proxy-api"],
        baseURL: "https://gateway.example.com/proxy/v1/chat/completions/",
      }),
    ).toBe("https://gateway.example.com/proxy/v1")
  })

  it("normalizes grok2api model and response endpoints while preserving proxy paths", () => {
    expect(
      getProviderConnectionURL({
        ...DEFAULT_PROVIDER_CONFIG.grok2api,
        baseURL: "https://gateway.example.com/grok/v1/models?tenant=one#ignored",
      }),
    ).toBe("https://gateway.example.com/grok/v1?tenant=one")
    expect(
      getProviderConnectionURL({
        ...DEFAULT_PROVIDER_CONFIG.grok2api,
        baseURL: "https://gateway.example.com/grok",
      }),
    ).toBe("https://gateway.example.com/grok/v1")
  })

  it("does not rewrite legacy custom-provider URLs", () => {
    expect(
      getProviderConnectionURL({
        ...DEFAULT_PROVIDER_CONFIG["openai-compatible"],
        baseURL: "https://example.com/chat/completions",
      }),
    ).toBe("https://example.com/chat/completions")
  })
})
