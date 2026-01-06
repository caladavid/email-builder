<template>
  <UTabs :items="tabs" variant="link" class="h-full " :ui="tabsUi"
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

    <template #list-trailing class="bg-red-300">
      <div :class="['flex w-full justify-end md:gap-x-2', inspectorDrawer.inspectorDrawerOpen ? 'mr-6' : '']">
        <UTooltip text="Deshacer">
          <UButton   
            icon="material-symbols:undo"  
            :disabled="!inspectorDrawer.canUndo()"  
            @click="inspectorDrawer.undo()"  
            variant="ghost"  
            color="neutral"  
          />  
        </UTooltip>
        
        <UTooltip text="Rehacer">
          <UButton   
            icon="material-symbols:redo"  
            :disabled="!inspectorDrawer.canRedo()"  
            @click="inspectorDrawer.redo()"  
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
      <div :style="mainBoxStyle">
        <EditorBlock id="root" />
      </div>
    </template>
    <template #preview>
      <div :style="mainBoxStyle">
        <Reader :document="processedDocument" root-block-id="root" />
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
import { computed } from 'vue'
import HtmlPanel from './HtmlPanel.vue'
import JsonPanel from './JsonPanel.vue'
import ImportJson from './ImportJson/index.vue'
import DownloadJson from './DownloadJson/index.vue'
/* import { Reader } from '@flyhub/email-builder' */
import { useInspectorDrawer } from '../../documents/editor/editor.store'
import VariablesModal from '../VariablesModal/index.vue'
import { createProcessedDocument } from '../../utils/documentProcessor'
/* import { Reader } from '../../lib/@flyhub/email-builder' */
import { Reader } from '../../lib/email-builder/index'


// FIXME: implement
// import ShareButton from './ShareButton.vue'

// FIXME: implement handleChangeSelectedScreenSize

const inspectorDrawer = useInspectorDrawer()

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

const tabsUi = computed(() => {
  if (inspectorDrawer.selectedScreenSize === 'mobile') {
    return { content: 'bg-gray-100 h-full w-full overflow-x-hidden ' }
  }
  return { content: 'bg-gray-100 h-full overflow-x-hidden' }
})


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
