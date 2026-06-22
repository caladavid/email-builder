<template>
  <div
    ref="containerRef"
    class="relative w-full h-full overflow-y-auto"
    style="background: #f5f5f5;"
    @click.self="handleContainerClick"
  >
    <div :style="wrapperStyle" class="relative mx-auto mt-10 mb-6">
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
        <!-- Formatting mini-bar (top-right, solo en bloques de texto) -->
        <div v-if="isTextBlock" style="position:absolute;top:-30px;right:0;display:flex;align-items:center;gap:1px;background:#0033A0;padding:3px 5px;border-radius:6px 6px 0 0;pointer-events:all;" @click.stop>
          <button @click.stop="handleFormat('bold')"          title="Negrita (Ctrl+B)"   style="width:24px;height:24px;border:none;background:transparent;color:white;font-family:serif;font-size:14px;font-weight:800;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;"><b>B</b></button>
          <button @click.stop="handleFormat('italic')"        title="Cursiva (Ctrl+I)"   style="width:24px;height:24px;border:none;background:transparent;color:white;font-family:serif;font-size:14px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;"><i>I</i></button>
          <button @click.stop="handleFormat('underline')"     title="Subrayado"          style="width:24px;height:24px;border:none;background:transparent;color:white;font-family:serif;font-size:14px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;"><u>U</u></button>
          <button @click.stop="handleFormat('strikeThrough')" title="Tachado"            style="width:24px;height:24px;border:none;background:transparent;color:white;font-family:serif;font-size:13px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;"><s>S</s></button>
          <div style="width:1px;height:16px;background:rgba(255,255,255,0.3);margin:0 2px;flex-shrink:0;" />
          <button @click.stop="handleFormat('justifyLeft')"   title="Alinear izquierda"  style="width:24px;height:24px;border:none;background:transparent;color:white;font-size:13px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;">&#8676;</button>
          <button @click.stop="handleFormat('justifyCenter')" title="Centrar"            style="width:24px;height:24px;border:none;background:transparent;color:white;font-size:13px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;">&#9776;</button>
          <button @click.stop="handleFormat('justifyRight')"  title="Alinear derecha"    style="width:24px;height:24px;border:none;background:transparent;color:white;font-size:13px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;">&#8677;</button>
          <div style="width:1px;height:16px;background:rgba(255,255,255,0.3);margin:0 2px;flex-shrink:0;" />
          <button @click.stop="showLinkInput = !showLinkInput" title="Enlace" style="width:24px;height:24px;border:none;background:transparent;color:white;font-size:13px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;">🔗</button>
          <button @click.stop="handleFormat('removeFormat')"  title="Limpiar formato"    style="width:24px;height:24px;border:none;background:transparent;color:white;font-size:11px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;">T✕</button>
          <!-- Link URL input -->
          <div v-if="showLinkInput" style="display:flex;gap:3px;align-items:center;margin-left:4px;">
            <input
              v-model="linkUrl"
              type="url"
              placeholder="https://..."
              style="font-size:11px;padding:2px 6px;border:1px solid rgba(255,255,255,0.4);border-radius:4px;width:140px;background:rgba(255,255,255,0.15);color:white;outline:none;"
              @click.stop
              @mousedown.stop
              @keydown.enter.stop="applyLink"
              @keydown.escape.stop="showLinkInput = false"
            />
            <button @click.stop="applyLink" style="width:22px;height:22px;border:none;background:#22c55e;color:white;font-size:12px;font-weight:700;cursor:pointer;border-radius:3px;">✓</button>
          </div>
        </div>
      </div>

      <!-- TuneMenu de acción (flotante, sí tiene pointer-events) -->
      <TuneMenuOverlay
        v-if="overlayRect && store.selectedElementPath"
        :rect="overlayRect"
        @action="handleTuneAction"
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
          v-show="store.selectedElementTagName !== 'placeholder'"
          style="width:24px;height:24px;border-radius:50%;background:#0079CC;border:2px solid white;color:white;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);"
          @click="showBlockPicker = !showBlockPicker"
        >+</button>

        <!-- Block picker popup -->
        <div
          v-if="showBlockPicker"
          style="position:absolute;top:30px;left:50%;transform:translateX(-50%);background:#0033A0;border-radius:14px;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,0.32);z-index:300;width:296px;max-height:380px;overflow-y:auto;"
        >
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
            <div
              v-for="btn in BUTTONS"
              :key="btn.label"
              style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:10px 4px 8px;background:white;border-radius:8px;cursor:pointer;min-height:72px;"
              @mouseenter="($event.currentTarget as HTMLElement).style.boxShadow='0 2px 8px rgba(0,0,0,0.18)'"
              @mouseleave="($event.currentTarget as HTMLElement).style.boxShadow='none'"
              @click.stop="insertBlockAt(btn)"
            >
              <UIcon :name="btn.icon" style="font-size:22px;color:#0033A0;" />
              <span style="font-size:9px;font-weight:700;color:#0033A0;text-align:center;line-height:1.2;">{{ btn.label }}</span>
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

const store = useInspectorDrawer();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const iframeHeight = ref(600);
const overlayRect = ref<{ top: number; left: number; width: number; height: number } | null>(null);
const editingRect = ref<{ top: number; left: number; width: number; height: number } | null>(null);
const isEditing = ref(false);
const bridgeReady = ref(false);
const showBlockPicker = ref(false);
const showLinkInput = ref(false);
const linkUrl = ref('');

const TEXT_BLOCK_TYPES = new Set(['Encabezado', 'Texto', 'Botón', 'Html', 'Enlace', 'Contenedor']);
const TEXT_HTML_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TD', 'TH', 'LI', 'A', 'SPAN', 'DIV']);
const isTextBlock = computed(() =>
  TEXT_BLOCK_TYPES.has(store.selectedElementTagName) ||
  TEXT_HTML_TAGS.has(store.selectedElementTagName.toUpperCase())
);

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
      showBlockPicker.value = data.blockType === 'placeholder';
      
      store.selectedElementPath = data.path;
      store.selectedElementStyles = data.styles ?? {};
      store.selectedElementAttrs = data.attrs ?? {};
      store.selectedElementTagName = data.blockType ?? data.tagName ?? '';
      store.selectedElementInnerText = data.innerText ?? '';
      store.selectedElementChildData = data.childData ?? null;
      overlayRect.value = data.rect ?? null;
      store.selectedSidebarTab = 'styles';
      if (!store.inspectorDrawerOpen) {
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
      // Keep overlayRect so mini-bar stays visible during editing
      editingRect.value = data.rect ?? overlayRect.value;
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

    case 'outerhtml-response':
      if (data.html) store.htmlClipboard = data.html;
      break;

    case 'keydown': {
      const { key, ctrlKey, shiftKey, altKey } = data;
      const k = (key as string).toLowerCase();
      if (ctrlKey && !shiftKey && k === 'z') { store.undoHtml(); }
      else if (ctrlKey && (k === 'y' || (shiftKey && k === 'z'))) { store.redoHtml(); }
      else if (ctrlKey && k === 'c' && store.selectedElementPath) {
        sendToCanvas({ type: 'get-outerhtml', path: store.selectedElementPath });
      } else if (ctrlKey && k === 'v' && store.htmlClipboard) {
        sendToCanvas({ type: 'insert-html', path: store.selectedElementPath ?? 'body', position: 'after', html: store.htmlClipboard });
      } else if (ctrlKey && k === 'd' && store.selectedElementPath) {
        sendToCanvas({ type: 'duplicate', path: store.selectedElementPath });
      } else if (altKey && key === 'ArrowUp' && store.selectedElementPath) {
        sendToCanvas({ type: 'move-up', path: store.selectedElementPath });
      } else if (altKey && key === 'ArrowDown' && store.selectedElementPath) {
        sendToCanvas({ type: 'move-down', path: store.selectedElementPath });
      } else if ((key === 'Delete' || key === 'Backspace') && store.selectedElementPath) {
        sendToCanvas({ type: 'delete-element', path: store.selectedElementPath });
        store.selectedElementPath = null;
        overlayRect.value = null;
      }
      break;
    }

    case 'tree-response':
      // Layer Manager picks this up via its own listener
      break;

    case 'drop-request':
      if (store.draggedHtml) {
        if (store.rawHtml.includes('data-block-type="placeholder"')) {
          sendToCanvas({ type: 'replace-html', path: '[data-block-type="placeholder"]', html: store.draggedHtml });
        } else {
          sendToCanvas({ type: 'insert-html', path: data.path, position: data.position ?? 'after', html: store.draggedHtml });
        }
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
  
  // 🚀 Si el elemento seleccionado es nuestro lienzo vacío, lo REEMPLAZAMOS
  if (store.selectedElementTagName === 'placeholder') {
    sendToCanvas({ type: 'replace-html', path: path, html: btn.htmlTemplate });
  } else {
    // Si es un bloque normal, lo insertamos DEBAJO (after)
    sendToCanvas({ type: 'insert-html', path, position: 'after', html: btn.htmlTemplate });
  }
}

function handleFormat(command: string, value?: string) {
  sendToCanvas({ type: 'exec-command', command, value: value ?? '' });
}

function applyLink() {
  const url = linkUrl.value.trim();
  if (url) handleFormat('createLink', url);
  showLinkInput.value = false;
  linkUrl.value = '';
}

defineExpose({ sendToCanvas });

// ── Watch rawHtml → rewrite iframe ──────────────────────────────────────────

watch(
  () => store.rawHtml,
  (html) => {
    console.debug('[IframeCanvas] rawHtml watcher fired | _suppressWrite:', _suppressWrite, '| overlayRect:', overlayRect.value ? 'set' : 'null');
    if (_suppressWrite) return;
    if (html) {
      console.debug('[IframeCanvas] rawHtml watcher: CLEARING overlayRect + rewriting iframe');
      overlayRect.value = null;
      writeHtmlToIframe(html);
    }
  }
);

// Diagnóstico: trazar cuándo overlayRect cambia y qué lo cambia
watch(overlayRect, (val) => {
  console.debug('[IframeCanvas] overlayRect →', val ? `top:${val.top} left:${val.left} ${val.width}x${val.height}` : 'NULL');
});
watch(() => store.selectedElementTagName, (val) => {
  console.debug('[IframeCanvas] selectedElementTagName →', JSON.stringify(val), '| isTextBlock:', TEXT_BLOCK_TYPES.has(val) || TEXT_HTML_TAGS.has(val.toUpperCase()));
});

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
