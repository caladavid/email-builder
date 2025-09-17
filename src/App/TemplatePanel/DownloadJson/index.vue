<template>
  <UTooltip text="Descargar archivo JSON">
    <UButton
      :to="href"
      variant="ghost"
      color="neutral"
      icon="material-symbols:download"
      class="cursor-pointer"
      download="emailTemplate.json"
    />
  </UTooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useInspectorDrawer } from '../../../documents/editor/editor.store'

const inspectorDrawer = useInspectorDrawer()

const href = computed(() => {
  const doc = inspectorDrawer.document
  return `data:text/plain,${encodeURIComponent(JSON.stringify(doc, null, '  '))}`;
})
</script>
