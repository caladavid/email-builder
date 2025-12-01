<template> 
    <UButton  
        icon="material-symbols:apps"  
        class="absolute -right-4 top-0 w-fit h-14 flex flex-row-reverse border-2 border-[var(--ui-bg)] bg-[var(--ui-bg)] z-50 cursor-grab hover:opacity-[1]"
        draggable="true"  
        @dragstart="handleDragStart"  
        @dragend="handleDragEnd"   
    />  
  <div   
      
    
    title="Arrastrar bloque"   
  >  
  </div>  
</template>

<script setup lang="ts">
import { useDragAndDrop } from '../../../composables/useDragAndDrop';

const props = defineProps<{
    blockId: string;
}>()

const dragAndDrop = useDragAndDrop(() => props.blockId);

function handleDragStart(event: DragEvent){
    dragAndDrop.handleDragStart(event);
};

function handleDragEnd(event: DragEvent) {  
  dragAndDrop.handleDragEnd();  
} 

</script>

<style scoped>  
</style>