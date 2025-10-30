<script setup lang="ts">
import { useInspectorDrawer } from '../documents/editor/editor.store'
import TemplatePanel from './TemplatePanel/index.vue'
import EditorInspectorDrawer from './InspectorDrawer/index.vue'
import { onMounted } from 'vue'
import SamplesDrawer from './InspectorDrawer/SamplesDrawer/index.vue'
import { SAMPLES_DRAWER_WIDTH } from './InspectorDrawer/SamplesDrawer/constants'

const inspectorDrawer = useInspectorDrawer()

// Inicializar variables desde el componente padre  
onMounted(() => {  
  inspectorDrawer.initializeGlobalVariables({  
    userName: 'John Doe',  
    companyName: 'Acme Corp',  
    currentDate: new Date().toLocaleDateString(),  
    // Agrega aquí tus variables personalizadas  
  })  
})  
</script>

<template>
  <SamplesDrawer />
  <EditorInspectorDrawer />
  
  <div
    class="transition-all duration-200 h-full"
    :style="{
      marginLeft: inspectorDrawer.samplesDrawerOpen ? `${SAMPLES_DRAWER_WIDTH}px` : '0', 
      marginRight: inspectorDrawer.inspectorDrawerOpen ? `${inspectorDrawer.INSPECTOR_DRAWER_WIDTH}px` : `0`,
    }">
    <TemplatePanel />
  </div>

</template>
