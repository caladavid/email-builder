<template>  
  <UButton  
    variant="ghost"  
    size="sm"  
    @click="editorStore.toggleSamplesDrawerOpen()"  
    :style="{color: 'var(--ui-text)'}"  
  >  
    <UIcon  
      :name="editorStore.samplesDrawerOpen ? 'i-heroicons-chevron-left' : 'i-heroicons-bars-3'"  
      class="w-5 h-5"  
    />  
  </UButton>  
</template>  
  
<script setup lang="ts">
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
  
const editorStore = useInspectorDrawer();  
</script>