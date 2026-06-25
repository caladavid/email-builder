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
          <button @click.stop="showLinkInput = !showLinkInput" title="Enlace" style="width:24px;height:24px;border:none;background:transparent;color:white;font-size:13px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;">🔗</button>
          <button @click.stop="handleFormat('removeFormat')"  title="Limpiar formato"    style="width:24px;height:24px;border:none;background:transparent;color:white;font-size:11px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;">T✕</button>
          <!-- Variables button -->
          <div style="width:1px;height:16px;background:rgba(255,255,255,0.3);margin:0 2px;flex-shrink:0;" />
          <div style="position:relative;">
            <button @click.stop="showVarsDropdown = !showVarsDropdown; showLinkInput = false" title="Insertar variable"
              style="width:24px;height:24px;border:none;background:transparent;color:white;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;">
              <UIcon name="material-symbols:variable-insert" style="font-size:16px;" />
            </button>
            <div v-if="showVarsDropdown" @click.stop
              style="position:absolute;top:28px;right:0;background:#001f6e;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:500;min-width:140px;max-height:200px;overflow-y:auto;">
              <div v-if="variableItems.length === 0" style="padding:6px 10px;color:rgba(255,255,255,0.6);font-size:11px;white-space:nowrap;">No hay variables disponibles</div>
              <div v-for="v in variableItems" :key="v.key"
                @mousedown.prevent="insertVariableAtCursor(v.key)"
                style="padding:5px 10px;border-radius:4px;cursor:pointer;color:white;font-size:11px;font-family:monospace;white-space:nowrap;transition:background 0.1s;"
                @mouseenter="($event.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.15)'"
                @mouseleave="($event.currentTarget as HTMLElement).style.background='transparent'">
                {{ '{' + v.key + '}' }}
              </div>
            </div>
          </div>
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


      <!-- Placeholder picker — auto-opens when placeholder block is selected -->
      <div
        v-if="showBlockPicker && overlayRect && store.selectedElementTagName === 'placeholder'"
        :style="{
          position: 'absolute',
          top: (overlayRect.top + overlayRect.height + 8) + 'px',
          left: (overlayRect.left + overlayRect.width / 2) + 'px',
          transform: 'translateX(-50%)',
          zIndex: 300,
          background: '#0033A0',
          borderRadius: '14px',
          padding: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
          width: '360px',
          maxHeight: '420px',
          overflowY: 'auto',
        }"
        @click.stop
      >
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
          <div
            v-for="btn in BUTTONS" :key="btn.label"
            style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 8px;background:white;border-radius:8px;cursor:pointer;min-height:80px;border:1px solid #c7d8f5;transition:border-color 0.12s,box-shadow 0.12s;"
            @mouseenter="(($event.currentTarget as HTMLElement).style.boxShadow='0 3px 10px rgba(0,0,0,0.18)'); (($event.currentTarget as HTMLElement).style.borderColor='#0079CC')"
            @mouseleave="(($event.currentTarget as HTMLElement).style.boxShadow='none'); (($event.currentTarget as HTMLElement).style.borderColor='#c7d8f5')"
            @click.stop="insertBlockAt(btn)"
          >
            <UIcon :name="btn.icon" style="font-size:24px;color:#0033A0;" />
            <span style="font-size:11px;font-weight:700;color:#0033A0;text-align:center;line-height:1.2;">{{ btn.label }}</span>
          </div>
        </div>
      </div>

      <!-- Hover "+" button — appears on bottom edge of any block on mousemove -->
      <div
        v-if="addButtonInfo && !isEditing"
        :style="{
          position: 'absolute',
          top: (addButtonInfo.rect.top + addButtonInfo.rect.height - 12) + 'px',
          left: (addButtonInfo.rect.left + addButtonInfo.rect.width / 2) + 'px',
          transform: 'translateX(-50%)',
          zIndex: 198,
          pointerEvents: 'all',
        }"
        @click.stop
      >
        <button
          style="width:24px;height:24px;border-radius:50%;background:#0079CC;border:2px solid white;color:white;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);"
          @click.stop="showAddPicker = !showAddPicker; showBlockPicker = false"
        >+</button>

        <div
          v-if="showAddPicker"
          style="position:absolute;top:30px;left:50%;transform:translateX(-50%);background:#0033A0;border-radius:8px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,0.32);z-index:300;width:340px;max-height:400px;overflow-y:auto;"
        >
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
            <div
              v-for="btn in BUTTONS"
              :key="btn.label"
              style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;padding:10px 4px;border-radius:4px;cursor:pointer;border:1px solid transparent;transition:border-color 0.15s;"
              @mouseenter="($event.currentTarget as HTMLElement).style.borderColor='white'"
              @mouseleave="($event.currentTarget as HTMLElement).style.borderColor='transparent'"
              
              @click.stop="insertBlockFromAdd(btn)"
            >
              <div style="width:38px;height:38px;background:white;border-radius:2px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <UIcon :name="btn.icon" style="font-size:22px;color:#111111;" />
              </div>
              <span style="font-size:11px;font-weight:600;color:white;text-align:center;line-height:1.2;">{{ btn.label }}</span>
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
const showAddPicker = ref(false);
const addButtonInfo = ref<{ rect: { top: number; left: number; width: number; height: number }; path: string } | null>(null);
const showLinkInput = ref(false);
const linkUrl = ref('');
const showVarsDropdown = ref(false);

const variableItems = computed(() =>
  Object.entries(store.globalVariables || {}).map(([key, value]) => ({ key, value }))
);

function insertVariableAtCursor(key: string) {
  sendToCanvas({ type: 'exec-command', command: 'insertText', value: `{${key}}` });
  showVarsDropdown.value = false;
}

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
let _scrollEndTimer: ReturnType<typeof setTimeout> | null = null; // used by iframe-internal-scroll backup
// Debounce ResizeObserver: body-height pushes fire every 300ms → collapses multiple into one highlight
let _resyncTimer: ReturnType<typeof setTimeout> | null = null;

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
  pointerEvents: showAddPicker.value ? 'none' : 'auto',
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

  const existingPad = doc.getElementById('__canvas-padding__');
  if (!existingPad) {
    const style = doc.createElement('style');
    style.id = '__canvas-padding__';
    // Force html+body to auto-height so the iframe expands to full content height
    // instead of scrolling internally (templates often set height:100% which traps scroll inside the iframe)
    style.textContent = [
      'html { height: auto !important; overflow-y: visible !important; }',
      'body { height: auto !important; overflow-y: visible !important; padding-bottom: 160px !important; }',
      '* { word-break: break-word; overflow-wrap: break-word; }',
    ].join('\n');
    (doc.head || doc.body || doc.documentElement).appendChild(style);
  }

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
  iframeHeight.value = h;
  // ResizeObserver on the iframe element fires when height changes and handles overlay resync.
}

function insertBlockFromAdd(btn: (typeof BUTTONS)[0]) {
  showAddPicker.value = false;
  if (!addButtonInfo.value) { return; }
  sendToCanvas({ type: 'insert-html', path: addButtonInfo.value.path, position: 'after', html: btn.htmlTemplate });
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

    case 'hover-block-bottom':
      if (!showAddPicker.value) {
        addButtonInfo.value = data.rect ? { rect: data.rect, path: data.path } : null;
      }
      break;

    case 'select':
      if (showAddPicker.value) break;
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
      showAddPicker.value = false;
      showVarsDropdown.value = false;
      addButtonInfo.value = null;
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

    case 'image-loaded':
      nextTick(updateIframeHeight);
      break;

    case 'iframe-internal-scroll':
      // Template CSS resisted height:auto — iframe is scrolling internally.
      // Mirror the same clear-and-resync logic as containerRef scroll.
      overlayRect.value = null;
      if (_scrollEndTimer) clearTimeout(_scrollEndTimer);
      _scrollEndTimer = setTimeout(() => {
        _scrollEndTimer = null;
        if (store.selectedElementPath) {
          sendToCanvas({ type: 'highlight', path: store.selectedElementPath });
        }
      }, 150);
      break;

    case 'body-height':
      if (data.height && data.height > iframeHeight.value) {
        iframeHeight.value = data.height;
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
        if (data.isPlaceholder) {
          sendToCanvas({ type: 'replace-html', path: data.path, html: store.draggedHtml });
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
  showAddPicker.value = false;
  showBlockPicker.value = false;
  switch (action) {
    case 'up':        sendToCanvas({ type: 'move-up',   path }); break;
    case 'down':      sendToCanvas({ type: 'move-down', path }); break;
    case 'duplicate': sendToCanvas({ type: 'duplicate', path }); break;
    case 'delete':
      sendToCanvas({ type: 'delete-element', path });
      overlayRect.value = null;
      break;
    case 'parent':    sendToCanvas({ type: 'select-parent', path }); break;
    case 'child':     sendToCanvas({ type: 'select-child',  path }); break;
  }
}

function handleContainerClick() {
  showBlockPicker.value = false;
  showAddPicker.value = false;
  addButtonInfo.value = null;
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
    if (_suppressWrite) { return; }
    if (html) {
      overlayRect.value = null;
      writeHtmlToIframe(html);
    }
  }
);

// ── Overlay refresh ──────────────────────────────────────────────────────────

// Drawer open/close shifts the canvas position without changing iframe size → ResizeObserver won't fire
watch([() => store.inspectorDrawerOpen, () => store.samplesDrawerOpen], () => {
  nextTick(() => resyncOverlayPosition());
});

watch(() => store.selectedScreenSize, () => {
  nextTick(() => {
    updateIframeHeight();
    if (store.selectedElementPath) {
      setTimeout(() => {
        if (store.selectedElementPath) {
          sendToCanvas({ type: 'highlight', path: store.selectedElementPath });
        }
      }, 80);
    }
  });
});

function refreshOverlayOnScroll() {
  // The overlay is position:absolute inside the scrollable wrapper — it tracks the block
  // automatically with no JS needed. Just debounce a resync after scroll settles in case
  // of layout shifts. Do NOT clear overlayRect here (that causes the flicker).
  resyncOverlayPosition();
}

function resyncOverlayPosition() {
  // Resync coords without hiding (used by ResizeObserver — iframe resize ≠ scroll).
  // Debounced: body-height pushes fire every 300ms and each one grows the iframe,
  // causing rapid ResizeObserver fires — collapse them into a single highlight per burst.
  if (!store.selectedElementPath) return;
  if (_resyncTimer) clearTimeout(_resyncTimer);
  _resyncTimer = setTimeout(() => {
    _resyncTimer = null;
    if (store.selectedElementPath) {
      sendToCanvas({ type: 'highlight', path: store.selectedElementPath });
    }
  }, 80);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  window.addEventListener('message', handleMessage);
  window.addEventListener('resize', resyncOverlayPosition);
  containerRef.value?.addEventListener('scroll', refreshOverlayOnScroll);
  containerRef.value?.addEventListener('scroll', () => { if (!showAddPicker.value) addButtonInfo.value = null; });
  registerCanvasIframe(iframeRef.value);

  // ResizeObserver catches iframe height changes (content grows, images load, etc.)
  _resizeObserver = new ResizeObserver(() => resyncOverlayPosition());
  if (iframeRef.value) _resizeObserver.observe(iframeRef.value);

  if (store.rawHtml) writeHtmlToIframe(store.rawHtml);
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('resize', resyncOverlayPosition);
  containerRef.value?.removeEventListener('scroll', refreshOverlayOnScroll);
  _resizeObserver?.disconnect();
  _resizeObserver = null;
  if (_saveTimer) clearTimeout(_saveTimer);
  if (_scrollEndTimer) clearTimeout(_scrollEndTimer);
  if (_resyncTimer) clearTimeout(_resyncTimer);
  registerCanvasIframe(null);
});
</script>
