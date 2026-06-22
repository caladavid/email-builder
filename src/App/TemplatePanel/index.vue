<template>
  <UTabs :items="tabs" variant="pill"  class="h-full bg-[var(--color-primary)]" :ui="tabsUi"
>
    <template #list-leading >  
      <UButton  
        :icon="inspectorDrawer.samplesDrawerOpen ? 'material-symbols:first-page' : 'material-symbols:menu'"  
        variant="ghost"  
        color="neutral"  
        @click="inspectorDrawer.samplesDrawerOpen = !inspectorDrawer.samplesDrawerOpen"  
        class="cursor-pointer w-10 justify-center"  
      />  
    </template> 

    <template #list-trailing>
      <div :class="['flex w-full justify-end md:gap-x-2', inspectorDrawer.inspectorDrawerOpen ? 'mr-8' : '']">
        <UTooltip text="Deshacer">
          <UButton
            icon="material-symbols:undo"
            :disabled="isIframeMode ? !inspectorDrawer.canUndoHtml() : !inspectorDrawer.canUndo()"
            @click="isIframeMode ? inspectorDrawer.undoHtml() : inspectorDrawer.undo()"
            variant="ghost"
            color="neutral"
          />
        </UTooltip>

        <UTooltip text="Rehacer">
          <UButton
            icon="material-symbols:redo"
            :disabled="isIframeMode ? !inspectorDrawer.canRedoHtml() : !inspectorDrawer.canRedo()"
            @click="isIframeMode ? inspectorDrawer.redoHtml() : inspectorDrawer.redo()"
            variant="ghost"
            color="neutral"
          />
        </UTooltip>
        
        <!-- <DownloadJson /> -->
        <ImportJson />
        
        <!-- <VariablesModal /> -->
        
        <UButtonGroup>
          <UTooltip text="Vista de escritorio">
            <UButton
              :variant="inspectorDrawer.selectedScreenSize === 'desktop' ? 'solid' : 'outline'"
              color="neutral"
              icon="material-symbols:desktop-windows-outline"
              @click="handleScreenSizeChange('desktop')"
              class="cursor-pointer w-10 justify-center"
            />
          </UTooltip>
          <UTooltip text="Vista móvil">
            <UButton
              :variant="inspectorDrawer.selectedScreenSize === 'mobile' ? 'solid' : 'outline'"
              color="neutral"
              icon="material-symbols:phone-iphone-outline"
              @click="handleScreenSizeChange('mobile')"
              class="cursor-pointer w-10 justify-center"
            />
          </UTooltip>
        </UButtonGroup>

        <UButton
          :icon="inspectorDrawer.inspectorDrawerOpen ? 'material-symbols:last-page' : 'material-symbols:app-registration'"
          variant="ghost"
          color="neutral"
          @click="inspectorDrawer.inspectorDrawerOpen = !inspectorDrawer.inspectorDrawerOpen"
          class="cursor-pointer w-10"
        />
      </div>
    </template>
    <template #editor>
      <IframeCanvas v-if="isIframeMode" />
      <div v-else :style="mainBoxStyle">
        <EditorBlock id="root" />
      </div>
    </template>
    <template #preview>
      <div :style="mainBoxStyle">
        <iframe
          v-if="isIframeMode"
          :srcdoc="previewHtml"
          sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
          style="width:100%;height:100%;border:none;display:block;min-height:600px;"
        />
        <Reader v-else :document="processedDocument" root-block-id="root" />
      </div>
    </template>
    <template #html>
      <HtmlPanel />
    </template>
    <template #json>
      <JsonPanel />
    </template>
  </UTabs>
</template>

<script setup lang="ts">
import EditorBlock from '../../documents/editor/EditorBlock.vue'
import { computed, watch } from 'vue'
import { useKeyboardShortcuts } from '../../composables/useKeyboardShortcuts'
import HtmlPanel from './HtmlPanel.vue'
import JsonPanel from './JsonPanel.vue'
import ImportJson from './ImportJson/index.vue'
import DownloadJson from './DownloadJson/index.vue'
import { useInspectorDrawer } from '../../documents/editor/editor.store'
import VariablesModal from '../VariablesModal/index.vue'
import { createProcessedDocument } from '../../utils/documentProcessor'
import { Reader, renderToStaticMarkup } from '../../lib/email-builder/index'
import IframeCanvas from './IframeCanvas.vue'

const inspectorDrawer = useInspectorDrawer()

const isIframeMode = computed(() => !!inspectorDrawer.rawHtml)

// Blank canvas for new empty templates — placeholder block only, not real email content
const BLANK_EMAIL_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"/><style>*{box-sizing:border-box;}body{margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;}.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:1.2rem;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased;}</style></head><body><div data-block-type="placeholder" style="margin:0 auto;max-width:600px;min-height:48px;border:2px dashed #c7d8f5;border-radius:10px;background:#ffffff;display:flex;align-items:center;justify-content:center;cursor:pointer;"><div style="width:24px;height:24px;border-radius:50%;background:#0045B0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><span class="material-symbols-outlined" style="font-size:1.2rem;color:white;pointer-events:none;user-select:none;">add</span></div></div></body></html>`;

// Auto-convert block mode to iframe mode whenever rawHtml is cleared
watch(() => inspectorDrawer.rawHtml, async (html) => {
  if (html) return; // already in iframe mode
  try {
    const doc = createProcessedDocument(inspectorDrawer.document, inspectorDrawer.globalVariables || {});
    const rootBlock = (doc as any)['root'];
    const childrenIds: string[] = rootBlock?.data?.props?.childrenIds ?? rootBlock?.data?.childrenIds ?? [];
    // Empty template → start with a clean blank canvas instead of rendering the EmailLayout wrapper
    if (!childrenIds.length) {
      inspectorDrawer.importRawHtml(BLANK_EMAIL_HTML);
      return;
    }
    const rendered = await renderToStaticMarkup(doc, { rootBlockId: 'root' });
    inspectorDrawer.importRawHtml(rendered);
  } catch (e) {
    console.warn('Block→iframe auto-convert failed', e);
  }
}, { immediate: true })

// Strip bridge script + editor-only inline styles and attributes so preview is clean
const previewHtml = computed(() => {
  let html = inspectorDrawer.rawHtml;
  if (!html) return '';
  // Remove bridge script
  html = html.replace(/<script[^>]+id="__canvas-bridge__"[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove selection/hover outlines (outline and outline-offset, with optional leading ;)
  html = html.replace(/;?\s*outline(?:-offset)?\s*:[^;}"]*;?/gi, '');
  // Remove contenteditable attribute set by bridge editing mode
  html = html.replace(/\s*contenteditable="[^"]*"/gi, '');
  // Remove draggable attribute set by bridge
  html = html.replace(/\s*draggable="[^"]*"/gi, '');
  return html;
});

useKeyboardShortcuts()

const tabs = [
  {
    icon: 'material-symbols:edit-outline',
    slot: 'editor' as const
  },
  {
    icon: 'material-symbols:preview-outline',
    slot: 'preview' as const
  },
  {
    icon: 'material-symbols:code',
    slot: 'html' as const
  },
  {
    icon: 'material-symbols:data-object',
    slot: 'json' as const
  }
]

/** Computed */

const mainBoxStyle = computed(() => {
  if (inspectorDrawer.selectedScreenSize === 'mobile') {
    return {
      margin: '32px auto',
      width: '100%',
      maxWidth: '370px',   
      height: 'auto',    
      boxShadow:
        'rgba(33, 36, 67, 0.04) 0px 10px 20px, rgba(33, 36, 67, 0.04) 0px 2px 6px, rgba(33, 36, 67, 0.04) 0px 0px 1px',
    }
  }

  return {height: "100%"} // ← antes devolvías baseStyle con height heredado
})

/* const mainBoxStyle = computed(() => {
  const baseStyle = {
    height: '100%',
  }

  if (inspectorDrawer.selectedScreenSize === 'mobile') {
    return {
      ...baseStyle,
      margin: '32px auto',
      maxWidth: '370px',
      height: 'auto',
      boxShadow: 'rgba(33, 36, 67, 0.04) 0px 10px 20px, rgba(33, 36, 67, 0.04) 0px 2px 6px, rgba(33, 36, 67, 0.04) 0px 0px 1px',
    }
  }

  return baseStyle
}) */

const tabsUi = computed(() => ({
  // contenedor de la lista
  list: 'tabs-list bg-[var(--color-primary)]',
  // trigger controla color del texto/icono; activo negro, por defecto blanco
  trigger: 'text-white data-[state=active]:text-black transition-colors ',
  // hacemos que el icono use currentColor para heredar el color del trigger
  leadingIcon: 'text-current hover:text-[var(--color-secondary)]',
  content: inspectorDrawer.selectedScreenSize === 'mobile'
    ? 'bg-gray-100 h-full w-full overflow-x-hidden'
    : 'bg-gray-100 h-full overflow-x-hidden'
}))


/* const tabsUi = computed(() => {
  if (inspectorDrawer.selectedScreenSize === 'mobile') {
    return { content: 'bg-gray-100 h-full w-full overflow-x-hidden ' }
  }
  return { content: 'bg-gray-100 h-full overflow-x-hidden' }
}) */


/** Functions */

const handleScreenSizeChange = (value: unknown) => {
  switch (value) {
    case 'mobile':
    case 'desktop':
      inspectorDrawer.selectedScreenSize = value as 'mobile' | 'desktop';
      return;
    default:
      inspectorDrawer.selectedScreenSize = 'desktop';
  }
};

const processedDocument = computed(() => {  
  return createProcessedDocument(  
    inspectorDrawer.document,  
    inspectorDrawer.globalVariables || {}  
  );  
});  

</script>

<style scoped>

:deep(.tabs-list .bg-primary) { 
  background-color: white !important;
}

:deep(.tabs-list > [role="tab"][data-state="active"]) {
  color: black !important;
  pointer-events: none
}

</style>


