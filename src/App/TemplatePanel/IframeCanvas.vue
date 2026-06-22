<template>
  <div
    ref="containerRef"
    class="relative w-full h-full overflow-auto"
    style="background: #e5e7eb;"
    @click.self="handleContainerClick"
  >
    <div :style="wrapperStyle" class="relative mx-auto">
      <!-- Iframe real del canvas -->
      <iframe
        ref="iframeRef"
        :style="iframeStyle"
        sandbox="allow-same-origin allow-scripts"
        title="Email Canvas"
        @load="onIframeLoad"
      />

      <!-- Overlay de selección (posicionado sobre el iframe) -->
      <div
        v-if="overlayRect && store.selectedElementPath"
        :style="overlayWrapperStyle"
        class="pointer-events-none"
      >
        <div style="position:absolute;inset:0;border:2px solid rgba(0,121,204,1);pointer-events:none;" />
        <!-- Badge con tag name -->
        <div
          style="
            position:absolute;top:-20px;left:0;
            background:rgba(0,121,204,1);color:white;
            font-size:10px;padding:2px 6px;font-family:monospace;
            border-radius:3px 3px 0 0;white-space:nowrap;
          "
        >
          {{ store.selectedElementTagName.toLowerCase() }}
        </div>
      </div>

      <!-- TuneMenu de acción (flotante, sí tiene pointer-events) -->
      <TuneMenuOverlay
        v-if="overlayRect && store.selectedElementPath"
        :rect="overlayRect"
        @action="handleTuneAction"
      />

      <!-- Toolbar de formato (aparece al doble-click en modo edición) -->
      <FormattingToolbar
        v-if="isEditing"
        :rect="editingRect ?? { top: 48, left: 8, width: 200, height: 20 }"
        @format="handleFormat"
      />

      <!-- "+" add-block button — shows below selection overlay in iframe mode -->
      <div
        v-if="overlayRect && store.selectedElementPath && !isEditing"
        :style="{
          position: 'absolute',
          top: (overlayRect.top + overlayRect.height + 4) + 'px',
          left: (overlayRect.left + overlayRect.width / 2) + 'px',
          transform: 'translateX(-50%)',
          zIndex: 200,
        }"
        @click.stop
      >
        <button
          style="width:24px;height:24px;border-radius:50%;background:#0079CC;border:2px solid white;color:white;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);"
          @click="showBlockPicker = !showBlockPicker"
        >+</button>

        <!-- Block picker popup -->
        <div
          v-if="showBlockPicker"
          style="position:absolute;top:30px;left:50%;transform:translateX(-50%);background:white;border:1px solid #c7d8f5;border-radius:12px;padding:12px;box-shadow:0 8px 24px rgba(0,121,204,0.18);z-index:300;width:230px;max-height:300px;overflow-y:auto;"
        >
          <div style="font-size:10px;font-weight:700;color:#0045B0;margin-bottom:8px;">Insertar bloque después</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
            <div
              v-for="btn in BUTTONS"
              :key="btn.label"
              style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;background:#f0f6ff;border-radius:8px;cursor:pointer;border:1px solid #c7d8f5;"
              @mouseenter="($event.currentTarget as HTMLElement).style.background='#dbeafe'"
              @mouseleave="($event.currentTarget as HTMLElement).style.background='#f0f6ff'"
              @click.stop="insertBlockAt(btn)"
            >
              <UIcon :name="btn.icon" style="font-size:18px;color:#0079CC;" />
              <span style="font-size:9px;font-weight:600;color:#0045B0;text-align:center;line-height:1.2;">{{ btn.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useInspectorDrawer } from '../../documents/editor/editor.store';
import { CANVAS_BRIDGE_CODE } from '../../utils/canvas-bridge';
import { registerCanvasIframe, sendToCanvas } from '../../composables/useCanvasBridge';
import { BUTTONS } from '../../documents/blocks/helpers/buttons';
import TuneMenuOverlay from './TuneMenuOverlay.vue';
import FormattingToolbar from './FormattingToolbar.vue';

const store = useInspectorDrawer();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const iframeHeight = ref(600);
const overlayRect = ref<{ top: number; left: number; width: number; height: number } | null>(null);
const editingRect = ref<{ top: number; left: number; width: number; height: number } | null>(null);
const isEditing = ref(false);
const bridgeReady = ref(false);
const showBlockPicker = ref(false);

// Prevent double injection on the same document write (both @load and nextTick can fire)
let _bridgeInjected = false;
// Prevent circular: dom-changed → rawHtml → watcher → writeHtmlToIframe → dom-changed loop
let _suppressWrite = false;
// Debounce timer for dom-changed snapshot saves
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
// Prevent re-entrant overlay refresh (highlight → select → highlight loop)
let _overlayRefreshPending = false;
// ResizeObserver to catch iframe size changes (window resize, drawer open/close, etc.)
let _resizeObserver: ResizeObserver | null = null;

// ── Styles ───────────────────────────────────────────────────────────────────

const wrapperStyle = computed(() => {
  if (store.selectedScreenSize === 'mobile') {
    return {
      width: '375px',
      minHeight: iframeHeight.value + 'px',
      position: 'relative' as const,
      background: '#fff',
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      margin: '32px auto',
    };
  }
  return {
    width: '100%',
    minHeight: iframeHeight.value + 'px',
    position: 'relative' as const,
    background: '#fff',
  };
});

const iframeStyle = computed(() => ({
  display: 'block',
  width: '100%',
  height: iframeHeight.value + 'px',
  border: 'none',
}));

const overlayWrapperStyle = computed(() => {
  if (!overlayRect.value) return {};
  return {
    position: 'absolute' as const,
    top: overlayRect.value.top + 'px',
    left: overlayRect.value.left + 'px',
    width: overlayRect.value.width + 'px',
    height: overlayRect.value.height + 'px',
    pointerEvents: 'none',
    zIndex: 100,
  };
});

// ── Sanitize HTML before writing to iframe ──────────────────────────────────
// Prevents external connection failures from making the builder unusable.
function sanitizeForIframe(html: string): string {
  // Remove <base href> that would redirect resource requests to external servers
  html = html.replace(/<base[^>]*>/gi, '');
  // Remove <meta http-equiv="refresh"> that would navigate the iframe away
  html = html.replace(/<meta[^>]+http-equiv=["']refresh["'][^>]*\/?>/gi, '');
  // Remove external <script src="..."> (keep inline scripts)
  html = html.replace(/<script[^>]+src=["'][^"']*["'][^>]*><\/script>/gi, '');
  return html;
}

// ── Write HTML to iframe ─────────────────────────────────────────────────────

function writeHtmlToIframe(html: string) {
  const doc = iframeRef.value?.contentDocument;
  if (!doc) return;

  _bridgeInjected = false;
  bridgeReady.value = false;

  doc.open();
  doc.write(sanitizeForIframe(html));
  doc.close();

  // Fallback: inject bridge if @load didn't fire (some same-origin rewrites skip it)
  nextTick(() => {
    if (!_bridgeInjected) {
      _bridgeInjected = true;
      injectBridge(doc);
    }
  });
}

function injectBridge(doc: Document) {
  const existing = doc.getElementById('__canvas-bridge__');
  if (existing) existing.remove();
  try { (doc.defaultView as any).__canvasBridgeActive = false; } catch(e) {}

  const script = doc.createElement('script');
  script.id = '__canvas-bridge__';
  script.textContent = CANVAS_BRIDGE_CODE;
  (doc.head || doc.body || doc.documentElement).appendChild(script);
}

function updateIframeHeight() {
  const doc = iframeRef.value?.contentDocument;
  if (!doc) return;
  const h = Math.max(
    doc.documentElement.scrollHeight,
    doc.body?.scrollHeight ?? 0,
    400
  );
  const changed = h !== iframeHeight.value;
  iframeHeight.value = h;
  // Height changed → element positions shifted → refresh overlay (guarded against re-entry)
  if (changed && store.selectedElementPath && !_overlayRefreshPending) {
    _overlayRefreshPending = true;
    nextTick(() => {
      _overlayRefreshPending = false;
      if (store.selectedElementPath) {
        sendToCanvas({ type: 'highlight', path: store.selectedElementPath });
      }
    });
  }
}

// ── iframe load handler ──────────────────────────────────────────────────────

function onIframeLoad() {
  const doc = iframeRef.value?.contentDocument;
  if (!doc) return;
  registerCanvasIframe(iframeRef.value);
  if (!_bridgeInjected) {
    _bridgeInjected = true;
    injectBridge(doc);
  }
  updateIframeHeight();
}

// ── postMessage from bridge ──────────────────────────────────────────────────

function handleMessage(event: MessageEvent) {
  const data = event.data;
  if (!data || !data.type) return;

  // Only handle messages from the editor iframe, not from the preview iframe
  const editorDoc = iframeRef.value?.contentDocument;
  const editorWin = iframeRef.value?.contentWindow;
  if (event.source && editorWin && event.source !== editorWin) return;

  switch (data.type) {
    case 'bridge-ready':
      bridgeReady.value = true;
      // After iframe rewrite (undo/redo/load), re-highlight selected element at new position
      if (store.selectedElementPath) {
        nextTick(() => {
          if (store.selectedElementPath) {
            sendToCanvas({ type: 'highlight', path: store.selectedElementPath });
          }
        });
      }
      break;

    case 'select':
      showBlockPicker.value = false;
      store.selectedElementPath = data.path;
      store.selectedElementStyles = data.styles ?? {};
      store.selectedElementAttrs = data.attrs ?? {};
      store.selectedElementTagName = data.blockType ?? data.tagName ?? '';
      store.selectedElementInnerText = data.innerText ?? '';
      store.selectedElementChildData = data.childData ?? null;
      overlayRect.value = data.rect ?? null;
      store.selectedSidebarTab = 'styles';
      if (!store.inspectorDrawerOpen) {
        // Drawer opening causes layout shift → refresh overlay after Vue redraws
        store.inspectorDrawerOpen = true;
        if (!_overlayRefreshPending) {
          _overlayRefreshPending = true;
          nextTick(() => {
            _overlayRefreshPending = false;
            if (store.selectedElementPath) {
              sendToCanvas({ type: 'highlight', path: store.selectedElementPath });
            }
          });
        }
      }
      break;

    case 'deselect':
      showBlockPicker.value = false;
      store.selectedElementPath = null;
      store.selectedElementStyles = {};
      store.selectedElementAttrs = {};
      store.selectedElementTagName = '';
      overlayRect.value = null;
      break;

    case 'editing-start': {
      // Fallback to last known overlay rect if bridge didn't send one
      const fallbackRect = overlayRect.value;
      overlayRect.value = null;
      editingRect.value = data.rect ?? fallbackRect;
      isEditing.value = true;
      break;
    }

    case 'editing-end':
      isEditing.value = false;
      editingRect.value = null;
      break;

    case 'dom-changed':
      if (data.html) {
        const snapshotHtml = data.html;
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => {
          _suppressWrite = true;
          store.saveHtmlSnapshot(snapshotHtml);
          nextTick(() => { _suppressWrite = false; });
          sendToCanvas({ type: 'get-tree' });
          _saveTimer = null;
        }, 150);
        nextTick(updateIframeHeight);
      }
      break;

    case 'html-response':
      break;

    case 'tree-response':
      // Layer Manager picks this up via its own listener
      break;

    case 'drop-request':
      if (store.draggedHtml) {
        sendToCanvas({ type: 'insert-html', path: data.path, position: 'after', html: store.draggedHtml });
        store.draggedHtml = '';
      }
      break;
  }
}

// ── Commands to iframe ───────────────────────────────────────────────────────

function handleTuneAction(action: string) {
  const path = store.selectedElementPath;
  if (!path) return;
  switch (action) {
    case 'up':        sendToCanvas({ type: 'move-up',   path }); break;
    case 'down':      sendToCanvas({ type: 'move-down', path }); break;
    case 'duplicate': sendToCanvas({ type: 'duplicate', path }); break;
    case 'delete':
      sendToCanvas({ type: 'delete-element', path });
      overlayRect.value = null;
      break;
    case 'parent':    sendToCanvas({ type: 'select-parent', path }); break;
  }
}

function handleContainerClick() {
  showBlockPicker.value = false;
  sendToCanvas({ type: 'deselect' });
  overlayRect.value = null;
  store.selectedElementPath = null;
}

function insertBlockAt(btn: (typeof BUTTONS)[0]) {
  showBlockPicker.value = false;
  const path = store.selectedElementPath;
  if (!path) return;
  sendToCanvas({ type: 'insert-html', path, position: 'after', html: btn.htmlTemplate });
}

function handleFormat(command: string, value?: string) {
  sendToCanvas({ type: 'exec-command', command, value: value ?? '' });
}

defineExpose({ sendToCanvas });

// ── Watch rawHtml → rewrite iframe ──────────────────────────────────────────

watch(
  () => store.rawHtml,
  (html) => {
    if (_suppressWrite) return;
    if (html) {
      overlayRect.value = null; // Clear stale rect immediately; bridge-ready will re-highlight
      writeHtmlToIframe(html);
    }
  }
);

// ── Overlay refresh ──────────────────────────────────────────────────────────

function refreshOverlayOnScroll() {
  if (!store.selectedElementPath) return;
  // RAF ensures parent layout has settled before asking bridge for new coords
  requestAnimationFrame(() => {
    if (store.selectedElementPath) {
      sendToCanvas({ type: 'highlight', path: store.selectedElementPath });
    }
  });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  window.addEventListener('message', handleMessage);
  containerRef.value?.addEventListener('scroll', refreshOverlayOnScroll);
  registerCanvasIframe(iframeRef.value);

  // ResizeObserver covers window resize + drawer open/close + mobile toggle
  _resizeObserver = new ResizeObserver(() => refreshOverlayOnScroll());
  if (iframeRef.value) _resizeObserver.observe(iframeRef.value);

  if (store.rawHtml) writeHtmlToIframe(store.rawHtml);
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  containerRef.value?.removeEventListener('scroll', refreshOverlayOnScroll);
  _resizeObserver?.disconnect();
  _resizeObserver = null;
  if (_saveTimer) clearTimeout(_saveTimer);
  registerCanvasIframe(null);
});
</script>
