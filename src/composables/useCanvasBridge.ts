import { ref } from 'vue';

const _iframeRef = ref<HTMLIFrameElement | null>(null);

export function registerCanvasIframe(el: HTMLIFrameElement | null) {
  _iframeRef.value = el;
}

export function sendToCanvas(cmd: Record<string, unknown>) {
  _iframeRef.value?.contentWindow?.postMessage(cmd, '*');
}

export function getCanvasIframe(): HTMLIFrameElement | null {
  return _iframeRef.value;
}

// --- Suppress watcher flag ---
// Use a ref so Vite HMR preserves the value across hot-reloads (plain `let` creates
// separate module instances per reload, breaking cross-component flag sharing in dev).
const _suppressNextRawHtmlWriteRef = ref(false);

export function suppressNextRawHtmlWrite(): void {
  _suppressNextRawHtmlWriteRef.value = true;
}

export function consumeRawHtmlWriteSuppressed(): boolean {
  if (_suppressNextRawHtmlWriteRef.value) {
    _suppressNextRawHtmlWriteRef.value = false;
    return true;
  }
  return false;
}

// --- Live canvas snapshot ---
// Reads the live iframe DOM, strips editor outlines and bridge script — same
// output as notifyDomChanged() in canvas-bridge.ts, but synchronous and called
// from the parent frame.
export function snapshotCanvasHtml(): string | null {
  const doc = _iframeRef.value?.contentDocument;
  if (!doc) return null;

  // Temporarily clear editor outlines so they don't leak into the snapshot
  const outlineEls = doc.querySelectorAll('[style*="dashed"]');
  const savedOutlines: [HTMLElement, string, string][] = [];
  outlineEls.forEach((el) => {
    const h = el as HTMLElement;
    if (h.style?.outline?.includes('dashed')) {
      savedOutlines.push([h, h.style.outline, h.style.outlineOffset || '']);
      h.style.outline = '';
      h.style.outlineOffset = '';
    }
  });

  let html = doc.documentElement.outerHTML;

  // Restore outlines
  savedOutlines.forEach(([el, outline, offset]) => {
    el.style.outline = outline;
    el.style.outlineOffset = offset;
  });

  // Strip bridge script
  const bridgeStart = html.indexOf('<script id="__canvas-bridge__"');
  if (bridgeStart >= 0) {
    const closeTag = '</script>';
    const bridgeEnd = html.indexOf(closeTag, bridgeStart);
    if (bridgeEnd >= 0) html = html.slice(0, bridgeStart) + html.slice(bridgeEnd + closeTag.length);
  }

  return html;
}

// --- Clear pending snapshot callback ---
// StylesPanel calls clearPendingCanvasSnapshot() after a direct DOM save so that
// IframeCanvas's _pendingSnapshot (from an older dom-changed event) doesn't
// overwrite the newer rawHtml on unmount.
let _clearPendingSnapshotCb: (() => void) | null = null;

export function registerClearPendingSnapshot(cb: () => void): void {
  _clearPendingSnapshotCb = cb;
}

export function clearPendingCanvasSnapshot(): void {
  _clearPendingSnapshotCb?.();
}

export function useCanvasBridge() {
  return { sendToCanvas };
}
