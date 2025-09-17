<script setup lang="ts">
import { useInspectorDrawer } from '../documents/editor/editor.store'
import TemplatePanel from './TemplatePanel/index.vue'
import EditorInspectorDrawer from './InspectorDrawer/index.vue'
import { onMounted } from 'vue'

const inspectorDrawer = useInspectorDrawer()

// Inicializar variables desde el componente padre  
onMounted(() => {  
  inspectorDrawer.initializeGlobalVariables({  
    userName: 'John Doe',  
    companyName: 'Acme Corp',  
    currentDate: new Date().toLocaleDateString(),  
    /* test: "prueba" */
    // Agrega aquí tus variables personalizadas  
  })  
})  
</script>

<template>
  <EditorInspectorDrawer />

  <div
    class="transition-[margin-right] duration-200 h-full"
    :style="{
      marginRight: inspectorDrawer.inspectorDrawerOpen ? `${inspectorDrawer.INSPECTOR_DRAWER_WIDTH}px` : `0`,
    }">
    <TemplatePanel />
  </div>

</template>
