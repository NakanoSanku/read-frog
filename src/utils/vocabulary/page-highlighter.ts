import type { ContentScriptContext } from "#imports"
import type { Config } from "@/types/config/config"
import type { WordHighlightConfig } from "@/types/config/selection-toolbar"
import type { SavedVocabularyEntry, WordHighlightLookupDetail } from "@/types/vocabulary"
import { dequal } from "dequal"
import { storage } from "#imports"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  MAX_SAVED_VOCABULARY_CONTEXT_LENGTH,
  WORD_HIGHLIGHT_ATTRIBUTE,
  WORD_HIGHLIGHT_CLASS,
  WORD_HIGHLIGHT_LOOKUP_EVENT,
  WORD_HIGHLIGHT_STYLE_ELEMENT_ID,
} from "@/utils/constants/vocabulary"
import { logger } from "@/utils/logger"
import { createVocabularyMatcher } from "./matcher"
import { getSavedVocabulary, watchSavedVocabulary } from "./storage"
import { buildWordHighlightCSS } from "./style"

const EXCLUDED_PARENT_SELECTOR = [
  `[${WORD_HIGHLIGHT_ATTRIBUTE}]`,
  "script",
  "style",
  "noscript",
  "template",
  "textarea",
  "input",
  "select",
  "option",
  "button",
  "code",
  "pre",
  "[contenteditable]:not([contenteditable='false'])",
].join(",")

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml"

function normalizeContext(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SAVED_VOCABULARY_CONTEXT_LENGTH)
}

export class PageWordHighlighter {
  private entries: SavedVocabularyEntry[] = []
  private config: WordHighlightConfig = DEFAULT_CONFIG.selectionToolbar.wordHighlight
  private matcher = createVocabularyMatcher([])
  private observer: MutationObserver | null = null
  private queuedRoots = new Set<Node>()
  private scheduledFlush: number | null = null
  private styleElement: HTMLStyleElement | null = null
  private started = false

  constructor(private readonly document: Document) {}

  start() {
    if (this.started) return
    this.started = true
    this.document.addEventListener("click", this.handleClick, true)
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          this.queueRoot(mutation.target)
          continue
        }
        mutation.addedNodes.forEach((node) => this.queueRoot(node))
      }
    })
    this.observe()
    this.refreshAll()
  }

  update(config: WordHighlightConfig, entries: SavedVocabularyEntry[]) {
    this.config = config
    this.entries = entries
    this.matcher = createVocabularyMatcher(entries)
    if (this.started) this.refreshAll()
  }

  destroy() {
    if (!this.started) return
    this.started = false
    this.observer?.disconnect()
    this.observer = null
    this.document.removeEventListener("click", this.handleClick, true)
    this.cancelScheduledFlush()
    this.queuedRoots.clear()
    this.unwrapHighlights()
    this.styleElement?.remove()
    this.styleElement = null
  }

  private observe() {
    const root = this.document.documentElement
    if (!root || !this.observer) return
    this.observer.observe(root, { childList: true, characterData: true, subtree: true })
  }

  private refreshAll() {
    this.observer?.disconnect()
    this.cancelScheduledFlush()
    this.queuedRoots.clear()
    this.unwrapHighlights()
    this.updateStyle()
    if (this.config.enabled && this.entries.length > 0) {
      this.highlightRoot(this.document.body ?? this.document.documentElement)
    }
    this.observe()
  }

  private updateStyle() {
    if (!this.config.enabled) {
      this.styleElement?.remove()
      this.styleElement = null
      return
    }

    if (!this.styleElement?.isConnected) {
      const style = this.document.createElement("style")
      style.id = WORD_HIGHLIGHT_STYLE_ELEMENT_ID
      style.dataset.readFrogWordHighlightStyle = "true"
      ;(this.document.head ?? this.document.documentElement).append(style)
      this.styleElement = style
    }
    this.styleElement.textContent = buildWordHighlightCSS(this.config)
  }

  private queueRoot(root: Node) {
    if (!this.config.enabled || this.entries.length === 0) return
    this.queuedRoots.add(root)
    if (this.scheduledFlush !== null) return

    // Animation frames are suspended in background tabs. Subtitle DOM keeps changing there,
    // so use a short timer to batch mutations without tying correctness to page visibility.
    const view = this.document.defaultView
    this.scheduledFlush = view?.setTimeout(() => this.flushQueuedRoots(), 16) ?? null
    if (this.scheduledFlush === null) this.flushQueuedRoots()
  }

  private cancelScheduledFlush() {
    if (this.scheduledFlush === null) return
    this.document.defaultView?.clearTimeout(this.scheduledFlush)
    this.scheduledFlush = null
  }

  private flushQueuedRoots() {
    this.scheduledFlush = null
    const roots = [...this.queuedRoots]
    this.queuedRoots.clear()
    this.observer?.disconnect()
    roots.forEach((root) => {
      if (root.isConnected) this.highlightRoot(root)
    })
    this.observe()
  }

  private unwrapHighlights() {
    const parents = new Set<Node>()
    this.document.querySelectorAll<HTMLElement>(`[${WORD_HIGHLIGHT_ATTRIBUTE}]`).forEach((span) => {
      const parent = span.parentNode
      if (!parent) return
      parents.add(parent)
      span.replaceWith(this.document.createTextNode(span.textContent ?? ""))
    })
    parents.forEach((parent) => parent.normalize())
  }

  private highlightRoot(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) {
      this.highlightTextNode(root as Text)
      return
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return

    const walker = this.document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text)
    textNodes.forEach((node) => this.highlightTextNode(node))
  }

  private highlightTextNode(node: Text) {
    const value = node.nodeValue
    const parent = node.parentElement
    if (!value?.trim() || !parent || parent.namespaceURI !== XHTML_NAMESPACE) return
    if (parent.closest(EXCLUDED_PARENT_SELECTOR)) return

    const segments = this.matcher.split(value)
    if (!segments.some((segment) => segment.entry)) return

    const fragment = this.document.createDocumentFragment()
    for (const segment of segments) {
      if (!segment.entry) {
        fragment.append(this.document.createTextNode(segment.text))
        continue
      }

      const span = this.document.createElement("span")
      span.className = WORD_HIGHLIGHT_CLASS
      span.setAttribute(WORD_HIGHLIGHT_ATTRIBUTE, segment.entry.term)
      span.textContent = segment.text
      fragment.append(span)
    }
    node.replaceWith(fragment)
  }

  private handleClick = (event: MouseEvent) => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return

    const highlight = event
      .composedPath()
      .find(
        (candidate): candidate is HTMLElement =>
          candidate instanceof HTMLElement && candidate.hasAttribute(WORD_HIGHLIGHT_ATTRIBUTE),
      )
    if (!highlight) return

    const term = highlight.textContent?.trim()
    if (!term) return

    event.preventDefault()
    event.stopPropagation()
    const rect = highlight.getBoundingClientRect()
    const detail: WordHighlightLookupDetail = {
      term,
      context: normalizeContext(highlight.parentElement?.textContent),
      anchor: { x: rect.left, y: rect.bottom },
    }
    this.document.defaultView?.dispatchEvent(
      new CustomEvent<WordHighlightLookupDetail>(WORD_HIGHLIGHT_LOOKUP_EVENT, { detail }),
    )
  }
}

export async function setupPageWordHighlighter(
  ctx: ContentScriptContext,
  initialConfig: Config | null,
) {
  const highlighter = new PageWordHighlighter(document)
  let config =
    initialConfig?.selectionToolbar.wordHighlight ?? DEFAULT_CONFIG.selectionToolbar.wordHighlight
  let entries = await getSavedVocabulary().catch((error) => {
    logger.error("Failed to load saved vocabulary for page highlighting", error)
    return []
  })
  highlighter.update(config, entries)
  highlighter.start()

  const unwatchVocabulary = watchSavedVocabulary((nextEntries) => {
    entries = nextEntries
    highlighter.update(config, entries)
  })
  const unwatchConfig = storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (nextConfig) => {
    const nextWordHighlight =
      nextConfig?.selectionToolbar?.wordHighlight ?? DEFAULT_CONFIG.selectionToolbar.wordHighlight
    if (dequal(config, nextWordHighlight)) return
    config = nextWordHighlight
    highlighter.update(config, entries)
  })

  let destroyed = false
  const cleanup = () => {
    if (destroyed) return
    destroyed = true
    unwatchVocabulary()
    unwatchConfig()
    highlighter.destroy()
  }
  ctx.onInvalidated(cleanup)
  return cleanup
}
