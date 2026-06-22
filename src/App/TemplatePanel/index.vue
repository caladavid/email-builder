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
import { computed, nextTick, watch } from 'vue'
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

// Auto-convert block mode to iframe mode whenever rawHtml is cleared
watch(() => inspectorDrawer.rawHtml, async (html) => {
  if (html) return; // already in iframe mode
  await nextTick(); // wait for document to settle after resetDocument()
  try {
    const doc = createProcessedDocument(inspectorDrawer.document, inspectorDrawer.globalVariables || {});
    const rendered = await renderToStaticMarkup(doc, { rootBlockId: 'root' });
    inspectorDrawer.importRawHtml(rendered);
  } catch (e) {
    console.warn('Block→iframe auto-convert failed', e);
  }
}, { immediate: true })

// Strip injected bridge script so it doesn't interfere with the read-only preview
const previewHtml = computed(() => {
  const html = inspectorDrawer.rawHtml;
  if (!html) return '';
  return html.replace(/<script[^>]+id="__canvas-bridge__"[^>]*>[\s\S]*?<\/script>/gi, '');
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


