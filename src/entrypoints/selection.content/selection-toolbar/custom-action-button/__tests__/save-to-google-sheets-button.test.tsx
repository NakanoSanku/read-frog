// @vitest-environment jsdom
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { i18n } from "@/utils/i18n"
import { SaveToGoogleSheetsButton } from "../save-to-google-sheets-button"

const mocks = vi.hoisted(() => ({
  save: vi.fn<(...args: any[]) => any>(),
  saveVocabularyEntry: vi.fn<(...args: any[]) => any>(),
  toast: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("../use-save-to-google-sheets", () => ({
  useSaveToGoogleSheets: () => ({ save: mocks.save, isSaving: false }),
}))

vi.mock("@/utils/vocabulary/storage", () => ({
  saveVocabularyEntry: mocks.saveVocabularyEntry,
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: mocks.toast },
}))

const customDictionaryAction: SelectionToolbarCustomAction = {
  id: "custom-dictionary-action",
  name: "My Dictionary",
  icon: "tabler:book-2",
  providerId: "provider-1",
  systemPrompt: "Define the selected term.",
  prompt: "{{selection}}",
  outputSchema: [
    {
      id: "term-field",
      name: "Term",
      type: "string",
      description: "The selected word or phrase",
      speaking: true,
    },
  ],
}

describe("SaveToGoogleSheetsButton vocabulary mirroring", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.save.mockResolvedValue("saved")
    mocks.saveVocabularyEntry.mockResolvedValue(null)
  })

  it("adds the selected term to local vocabulary after a custom action saves to Sheets", async () => {
    render(
      <SaveToGoogleSheetsButton
        action={customDictionaryAction}
        isRunning={false}
        result={{ Term: "serendipity" }}
        selectedText="serendipity"
        context="A moment of serendipity."
        sourceTitle="Example"
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToGoogleSheets") }))

    await waitFor(() => {
      expect(mocks.saveVocabularyEntry).toHaveBeenCalledWith({
        term: "serendipity",
        context: "A moment of serendipity.",
        sourceTitle: "Example",
        sourceUrl: window.location.href,
      })
    })
  })

  it("does not add vocabulary when the Google Sheets save fails", async () => {
    mocks.save.mockResolvedValueOnce("failed")

    render(
      <SaveToGoogleSheetsButton
        action={customDictionaryAction}
        isRunning={false}
        result={{ Term: "serendipity" }}
        selectedText="serendipity"
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToGoogleSheets") }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.saveVocabularyEntry).not.toHaveBeenCalled()
  })
})
