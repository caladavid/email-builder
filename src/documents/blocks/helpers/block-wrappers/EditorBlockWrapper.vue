<template>  
  <div  
    :draggable="true"  
    :style="{  
      position: 'relative',  
      maxWidth: '100%',  
      outlineOffset: '-1px',  
      outline,  
      opacity: dragAndDrop.isDragging.value ? 0.5 : 1,  
      transition: 'opacity 0.2s'  
    }"  
    @mouseenter.stop="mouseInside = true"  
    @mouseleave="mouseInside = false"  
    @click.prevent.stop="handleClick"    
    @dragstart.stop="handleDragStart"  
    @dragover.prevent="dragAndDrop.handleDragOver"    
    @drop.prevent.stop="handleDrop"  
    @dragend="dragAndDrop.handleDragEnd"        
  >  
  <!-- ✅ Badge con info del bloque -->  
<!--     <div   
      v-if="mouseInside"   
      :style="{  
        position: 'absolute',  
        top: '-24px',  
        left: '0',  
        backgroundColor: 'rgba(0, 121, 204, 0.9)',  
        color: 'white',  
        padding: '4px 8px',  
        borderRadius: '4px',  
        fontSize: '11px',  
        fontFamily: 'monospace',  
        zIndex: 1001,  
        whiteSpace: 'nowrap'  
      }"  
    >  
      {{ blockInfo }}  
    </div>  -->

    <div v-if="dragAndDrop.showDropIndicator.value" :style="dragAndDrop.dropIndicatorStyle.value" />  
    <TuneMenu v-if="inspectorDrawer.selectedBlockId === currentBlockId" :block-id="currentBlockId" />  
    <slot />  
  </div>  
</template>  
  
<script setup lang="ts">  
import { currentBlockIdSymbol } from '../../../editor/EditorBlock.vue';  
import TuneMenu from './TuneMenu.vue';  
import { useInspectorDrawer } from '../../../editor/editor.store';  
import { computed, inject, ref } from 'vue';   
import { useDragAndDrop } from '../../../../composables/useDragAndDrop';
  
const inspectorDrawer = useInspectorDrawer();  
  
/** Refs */  
const mouseInside = ref(false);  
  
/** Injections */  
const currentBlockId = inject(currentBlockIdSymbol)!;  
  
/** Composables */  
const dragAndDrop = useDragAndDrop(() => currentBlockId);   
  
/** Computed */  
const outline = computed(() => {  
  if (inspectorDrawer.selectedBlockId === currentBlockId) return '2px solid rgba(0, 121, 204, 1)';  
  if (mouseInside.value) return '2px solid rgba(0, 121, 204, 0.3)';  
  return undefined;  
});  

const isDraggable = computed(() => {  
  const block = inspectorDrawer.document[currentBlockId];  
  // EmailLayout no debe ser arrastrable  
  return block && block.type !== 'EmailLayout';  
});  

/* const blockInfo = computed(() => {  
  const block = inspectorDrawer.document[currentBlockId];  
  if (!block) return 'Block not found';  
  return `${block.type} | ${currentBlockId}`;  
});  */

function handleDragStart(event: DragEvent) {  
  if (!isDraggable.value) {  
    event.preventDefault();  
    return;  
  }  
  dragAndDrop.handleDragStart(event);  
}  
  
function handleDrop(event: DragEvent) {  
  if (!isDraggable.value) return;  
  dragAndDrop.handleDrop(event);  
}  
  
function handleClick() {  
  inspectorDrawer.setSelectedBlockId(currentBlockId);  
} 
  
defineOptions({  
  inheritAttrs: false,  
});  
</script>