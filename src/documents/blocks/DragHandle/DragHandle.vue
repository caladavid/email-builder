<template> 
    <UButton  
        icon="material-symbols:apps"  
        class="drag-handle"
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
.drag-handle {  
  left: -20px;  
  top: 20px;  
  transform: translateY(-50%);  
  width: 16px;  
  height: 20px;  
  background: rgba(0, 121, 204, 0.8);  
  color: black;  
  font-size: 10px;  
  display: flex;  
  align-items: center;  
  justify-content: center;  
  border-radius: 3px;  
  cursor: grab;  
  opacity: 0;  
  transition: opacity 0.2s;  
  z-index: 1000;  
}  
  
.drag-handle:hover {  
  opacity: 1;  
  cursor: grabbing;  
}  
</style>