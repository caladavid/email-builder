<template>
  <HighlightedCodePanel type="html" :value="code" />
</template>

<script setup lang="ts">
import HighlightedCodePanel from './helper/HighlightedCodePanel.vue'
import { useInspectorDrawer } from '../../documents/editor/editor.store'
import { computed, ref, watch } from 'vue';
import { renderToStaticMarkup } from '@flyhub/email-builder'
import { createProcessedDocument, processDocumentVariables } from '../../utils/documentProcessor';
import { interpolateVariables } from '../../utils/variableInterpolator';

const inspectorDrawer = useInspectorDrawer()

const code = ref<string>('')

const processedDocument = computed(() => {  
  return createProcessedDocument(
    inspectorDrawer.document,
    inspectorDrawer.globalVariables
  )  
});  

/* watch(() => inspectorDrawer.document, async (document) => {
  const html = await renderToStaticMarkup(document, { rootBlockId: 'root' })

  code.value = html
}, { immediate: true }) */
watch(() => [inspectorDrawer.document, inspectorDrawer.globalVariables], async () => {  
  const html = await renderToStaticMarkup(processedDocument.value, { rootBlockId: 'root' })  
  code.value = html  
}, { immediate: true, deep: true }) 
</script>

