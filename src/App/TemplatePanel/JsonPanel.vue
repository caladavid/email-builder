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

watch(() => inspectorDrawer.document, async (document) => {
  const json = JSON.stringify(document, null, '  ')

  code.value = json
}, { immediate: true })
</script>
