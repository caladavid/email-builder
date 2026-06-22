import { onMounted, onUnmounted } from 'vue';
import { useInspectorDrawer } from '../documents/editor/editor.store';
import { sendToCanvas } from './useCanvasBridge';

export function useKeyboardShortcuts() {
  const store = useInspectorDrawer();

  function isEditingText(target: EventTarget | null): boolean {
    if (!target) return false;
    const el = target as HTMLElement;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.contentEditable === 'true') return true;
    return false;
  }


  function handleKeyDown(e: KeyboardEvent) {
    if (isEditingText(e.target)) return;

    const isIframeMode = !!store.rawHtml;
    const selectedPath = store.selectedElementPath;
    const selectedBlockId = store.selectedBlockId;

    // ── Undo / Redo ──────────────────────────────────────────────────────
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (isIframeMode) store.undoHtml();
      else store.undo();
      return;
    }
    if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      if (isIframeMode) store.redoHtml();
      else store.redo();
      return;
    }

    // ── Escape: deselect ─────────────────────────────────────────────────
    if (e.key === 'Escape') {
      if (isIframeMode) {
        sendToCanvas({ type: 'deselect' });
        store.selectedElementPath = null;
      } else {
        store.setSelectedBlockId(null);
      }
      return;
    }

    // ── Iframe mode shortcuts ────────────────────────────────────────────
    if (isIframeMode && selectedPath) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        sendToCanvas({ type: 'delete-element', path: selectedPath });
        store.selectedElementPath = null;
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        store.htmlClipboard = selectedPath;
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        sendToCanvas({ type: 'duplicate', path: selectedPath });
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'v' && store.htmlClipboard) {
        e.preventDefault();
        sendToCanvas({ type: 'duplicate', path: store.htmlClipboard });
        return;
      }

      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        sendToCanvas({ type: 'move-up', path: selectedPath });
        return;
      }

      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        sendToCanvas({ type: 'move-down', path: selectedPath });
        return;
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown, true));
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown, true));
}
