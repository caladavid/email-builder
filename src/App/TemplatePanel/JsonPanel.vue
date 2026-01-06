<template>
  <HighlightedCodePanel type="json" :value="processedDocument" />
</template>

<script setup lang="ts">
import HighlightedCodePanel from './helper/HighlightedCodePanel.vue'
import { useInspectorDrawer } from '../../documents/editor/editor.store'
import { computed, ref, watch } from 'vue'
import { createProcessedDocument } from '../../utils/documentProcessor'

const inspectorDrawer = useInspectorDrawer()

const code = ref<string>('')

const processedDocument = computed(() => {  
  const processed = createProcessedDocument(  
    inspectorDrawer.document,  
    inspectorDrawer.globalVariables || {}  
  );  
  return JSON.stringify(processed, null, 2);  
});

// Función para truncar base64 en el console.log (Obtener console.log sin base64, mas facil de copiar)
/* const truncateBase64ForConsole = (obj: any): any => {  
  if (typeof obj !== 'object' || obj === null) return obj;  
    
  if (Array.isArray(obj)) {  
    return obj.map(item => truncateBase64ForConsole(item));  
  }  
    
  const result: any = {};  
  for (const [key, value] of Object.entries(obj)) {  
    if (typeof value === 'string' && value.startsWith('data:image/') && value.includes('base64,')) {  
      result[key] = 'test...';  
    } else if (typeof value === 'object') {  
      result[key] = truncateBase64ForConsole(value);  
    } else {  
      result[key] = value;  
    }  
  }  
  return result;  
};   */
  
// Modificar el console.log existente  
/* console.log('JSON con base64 truncado:', truncateBase64ForConsole(JSON.parse(processedDocument.value))); */

/* console.log(processedDocument.value); */

watch(() => inspectorDrawer.document, async (document) => {
  const json = JSON.stringify(document, null, '  ')

  code.value = json
}, { immediate: true })
</script>
