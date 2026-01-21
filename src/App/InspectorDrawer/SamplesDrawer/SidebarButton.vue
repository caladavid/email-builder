<template>  
  <UButton  
    size="sm"  
    variant="ghost"  
    @click="handleClick"  
    class="text-[var(--color-blue)]"
  >  
    <slot />  
  </UButton>  
</template>  
  
<script setup lang="ts">  
 
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
import getConfiguration from '../../../getConfiguration';

  
const props = defineProps<{  
  href: string;  
}>();  
  
const editorStore = useInspectorDrawer();  
  
function handleClick() {    
  editorStore.resetDocument(getConfiguration(props.href));
  editorStore.samplesDrawerOpen = false   
}   

</script>