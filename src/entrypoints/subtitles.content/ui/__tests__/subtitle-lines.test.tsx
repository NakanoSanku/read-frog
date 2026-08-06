// @vitest-environment jsdom
import type { LangCodeISO6393 } from "@read-frog/definitions"
import { act, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { storage } from "#imports"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { SAVED_VOCABULARY_STORAGE_KEY } from "@/utils/constants/vocabulary"
import { currentSubtitleAtom, currentTimeMsAtom, sourceTrackAtom } from "../../atoms"
import { MainSubtitle, TranslationSubtitle } from "../subtitle-lines"

const mockedAtoms = vi.hoisted(() => ({
  languageAtom: null as any,
  selectionToolbarAtom: null as any,
  videoSubtitlesAtom: null as any,
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => (key === "subtitles.state.translating" ? "Translating…" : key),
  },
}))

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  const languageAtom = atom(DEFAULT_CONFIG.language)
  const selectionToolbarAtom = atom(DEFAULT_CONFIG.selectionToolbar)
  const videoSubtitlesAtom = atom(DEFAULT_CONFIG.videoSubtitles)

  mockedAtoms.languageAtom = languageAtom
  mockedAtoms.selectionToolbarAtom = selectionToolbarAtom
  mockedAtoms.videoSubtitlesAtom = videoSubtitlesAtom

  return {
    configFieldsAtomMap: {
      language: languageAtom,
      selectionToolbar: selectionToolbarAtom,
      videoSubtitles: videoSubtitlesAtom,
    },
  }
})

function createStoreWithLanguage(targetCode: LangCodeISO6393) {
  const store = createStore()
  store.set(mockedAtoms.languageAtom, {
    ...DEFAULT_CONFIG.language,
    targetCode,
  })
  store.set(mockedAtoms.videoSubtitlesAtom, DEFAULT_CONFIG.videoSubtitles)
  store.set(mockedAtoms.selectionToolbarAtom, DEFAULT_CONFIG.selectionToolbar)
  return store
}

describe("subtitle lines", () => {
  beforeEach(() => fakeBrowser.reset())

  it("applies rtl attributes to translation subtitle for Arabic target language", () => {
    const store = createStoreWithLanguage("arb")

    render(
      <Provider store={store}>
        <TranslationSubtitle content="مرحبًا" />
      </Provider>,
    )

    const line = screen.getByText("مرحبًا")
    expect(line).toHaveAttribute("dir", "rtl")
    expect(line).toHaveAttribute("lang", "ar")
  })

  it("applies ltr attributes to translation subtitle for English target language", () => {
    const store = createStoreWithLanguage("eng")

    render(
      <Provider store={store}>
        <TranslationSubtitle content="Hello world" />
      </Provider>,
    )

    const line = screen.getByText("Hello world")
    expect(line).toHaveAttribute("dir", "ltr")
    expect(line).toHaveAttribute("lang", "en")
  })

  it("keeps main subtitle line without forced dir/lang attributes", () => {
    const store = createStoreWithLanguage("eng")

    render(
      <Provider store={store}>
        <MainSubtitle content="Hello world" />
      </Provider>,
    )

    const line = screen.getByText("Hello world")
    expect(line).not.toHaveAttribute("dir")
    expect(line).not.toHaveAttribute("lang")
  })

  it("shows pending indicator when display cue has original but no translation", () => {
    const store = createStoreWithLanguage("eng")
    store.set(currentTimeMsAtom, 500)
    store.set(currentSubtitleAtom, null)
    store.set(sourceTrackAtom, [{ text: "Hello", start: 0, end: 1000 }])

    const { container } = render(
      <Provider store={store}>
        <TranslationSubtitle />
      </Provider>,
    )

    expect(container.querySelector("[data-pending='true']")).not.toBeNull()
    expect(screen.getByText("Translating")).toBeTruthy()
  })

  it("fades translation in when the pending cue resolves", () => {
    const store = createStoreWithLanguage("eng")
    store.set(currentTimeMsAtom, 500)
    store.set(currentSubtitleAtom, null)
    store.set(sourceTrackAtom, [{ text: "Hello", start: 0, end: 1000 }])

    const { container } = render(
      <Provider store={store}>
        <TranslationSubtitle />
      </Provider>,
    )

    expect(container.querySelector("[data-pending='true']")).not.toBeNull()

    act(() => {
      store.set(currentSubtitleAtom, {
        text: "Hello",
        start: 0,
        end: 1000,
        translation: "你好",
      })
    })

    const line = screen.getByText("你好")
    expect(line).toHaveClass("animate-subtitle-fade-in")
  })

  it("does not fade translation in for an already translated cue", () => {
    const store = createStoreWithLanguage("eng")
    store.set(currentTimeMsAtom, 500)
    store.set(currentSubtitleAtom, {
      text: "Hello",
      start: 0,
      end: 1000,
      translation: "你好",
    })

    render(
      <Provider store={store}>
        <TranslationSubtitle />
      </Provider>,
    )

    const line = screen.getByText("你好")
    expect(line).not.toHaveClass("animate-subtitle-fade-in")
  })

  it("highlights vocabulary saved from Dictionary inside subtitles", async () => {
    await storage.setItem(`local:${SAVED_VOCABULARY_STORAGE_KEY}`, [
      {
        id: "world",
        term: "world",
        normalizedTerm: "world",
        createdAt: 1,
        updatedAt: 1,
      },
    ])
    const store = createStoreWithLanguage("eng")

    render(
      <Provider store={store}>
        <MainSubtitle content="Hello world" />
      </Provider>,
    )

    await waitFor(() => {
      expect(screen.getByText("world")).toHaveClass("read-frog-word-highlight")
    })
  })
})
