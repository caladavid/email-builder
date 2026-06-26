<template>
  <HighlightedCodePanel type="json" :value="displayJson" />
</template>

<script setup lang="ts">
import HighlightedCodePanel from './helper/HighlightedCodePanel.vue'
import { useInspectorDrawer } from '../../documents/editor/editor.store'
import { computed } from 'vue'
import { createProcessedDocument } from '../../utils/documentProcessor'

const inspectorDrawer = useInspectorDrawer()

const displayJson = computed(() => {
  if (inspectorDrawer.rawHtml) {
    return JSON.stringify({ mode: 'iframe', rawHtml: inspectorDrawer.rawHtml }, null, 2);
  }
  const processed = createProcessedDocument(
    inspectorDrawer.document,
    inspectorDrawer.globalVariables || {}
  );
  return JSON.stringify(processed, null, 2);
});
</script>
