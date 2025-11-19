<template>
  <UAlert v-if="!block" type="warning" title="Block not found" />
  <div v-else class="h-full">
    <BuildBlockComponent :blocks="EDITOR_DICTIONARY" v-bind="block"  />
  </div>
</template>

<script lang="ts">
import { EDITOR_DICTIONARY } from './core'
import { BuildBlockComponent } from '@flyhub/email-document-core';
import { useInspectorDrawer } from './editor.store';
import type { InjectionKey } from 'vue';
import { computed, provide } from 'vue';
import { watch } from 'vue';

export const currentBlockIdSymbol = Symbol('currentBlockId') as InjectionKey<string>
</script>

<script setup lang="ts">
type EditorBlockProps = {
  id: string
}

const props = defineProps<EditorBlockProps>()
const inspectorDrawer = useInspectorDrawer()

provide(currentBlockIdSymbol, props.id)

const block = computed(() => inspectorDrawer.document[props.id])

/* watch(() => inspectorDrawer.document, (newDoc) => {  
  console.log('📄 Documento cambió en TemplatePanel:', {  
    root: newDoc.root,  
    bloques: Object.keys(newDoc).length  
  });  
}, { deep: true });   */

</script>

