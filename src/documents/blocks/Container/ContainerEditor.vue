<template>    
  <BaseContainer       
    :style="containerStyle"  
    @dragover="handleContainerDragOver"  
    @drop="handleContainerDrop"  
    @dragleave="handleContainerDragLeave"  
  >  
    <!-- Indicador visual -->  
    <div v-if="showContainerDropZone" :style="containerDropZoneStyle">  
      <div :style="dropZoneTextStyle">  
        Suelta aquí para agregar al {{ isContainerEmpty ? 'container vacío' : 'final del container' }}  
      </div>  
    </div>     
          
    <EditorChildrenIds      
      :children-ids="props.props?.childrenIds ?? []"      
      @change="handleUpdateChildrenIds"      
    />      
  </BaseContainer>      
</template>      
    
<script setup lang="ts">    
import BaseContainer from '@flyhub/email-block-container';    
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue';    
import type { EditorChildrenChange } from '../helpers/EditorChildrenIds.vue';    
import type { ContainerProps } from './ContainerPropsSchema';    
import { currentBlockIdSymbol } from '../../editor/EditorBlock.vue';    
import { useInspectorDrawer } from '../../editor/editor.store';    
import { useDragAndDrop } from '../../../composables/useDragAndDrop';    
import { computed, inject, ref } from 'vue';    
    
const props = defineProps<ContainerProps>();     
const inspectorDrawer = useInspectorDrawer();    
const showContainerDropZone = ref(false);     
const currentBlockId = inject(currentBlockIdSymbol) as string;    
const dragAndDrop = useDragAndDrop(() => currentBlockId);    
    
const isContainerEmpty = computed(() => (props.props?.childrenIds ?? []).length === 0);    
    
const containerStyle = computed(() => ({    
  ...props.style,    
  position: 'relative',    
  minHeight: isContainerEmpty.value ? '100px' : undefined,    
  outline: showContainerDropZone.value ? '2px dashed rgba(0, 121, 204, 0.5)' : undefined,    
}));    
    
const containerDropZoneStyle = {    
  position: 'absolute',    
  top: 0,    
  left: 0,    
  right: 0,    
  bottom: 0,    
  backgroundColor: 'rgba(0, 121, 204, 0.05)',    
  border: '2px dashed rgba(0, 121, 204, 0.8)',    
  display: 'flex',    
  alignItems: 'center',    
  justifyContent: 'center',    
  zIndex: 999,    
  pointerEvents: 'none'    
};    
    
const dropZoneTextStyle = {    
  backgroundColor: 'rgba(0, 121, 204, 0.9)',    
  color: 'white',    
  padding: '8px 16px',    
  borderRadius: '4px',    
  fontSize: '13px',    
  fontFamily: 'monospace'    
};    
    
function handleUpdateChildrenIds({ block, blockId, childrenIds }: EditorChildrenChange) {
  inspectorDrawer.debouncedSaveToHistory();    
  const document = inspectorDrawer.document;    
    
  inspectorDrawer.setDocument({    
    [blockId]: block,    
    [currentBlockId]: {    
      type: 'Container',    
      data: {    
        ...document[currentBlockId].data,    
        props: { childrenIds }    
      }    
    }    
  })    
    
  inspectorDrawer.setSelectedBlockId(blockId)    
}    
    
function handleContainerDragOver(event: DragEvent) {  
  const draggedId = event.dataTransfer?.getData('text/plain');  
    
  // ⚠️ CLAVE: Solo prevenir si es un bloque existente  
  if (!draggedId || !inspectorDrawer.document[draggedId]) {  
    // No es un bloque existente, NO prevenir - dejar que AddBlockButton lo maneje  
    return;  
  }  
    
  // Solo ahora prevenimos el evento  
  event.preventDefault();  
    
  const target = event.target as HTMLElement;  
  const isOverChild = target.closest('[draggable="true"]') !== null;  
    
  if (!isOverChild) {  
    showContainerDropZone.value = true;  
  }  
}  
  
function handleContainerDragLeave(event: DragEvent) {  
  const relatedTarget = event.relatedTarget as HTMLElement;  
  const currentTarget = event.currentTarget as HTMLElement;  
    
  if (!currentTarget.contains(relatedTarget)) {  
    showContainerDropZone.value = false;  
  }  
}  
  
function handleContainerDrop(event: DragEvent) {  
  const draggedId = event.dataTransfer?.getData('text/plain');  
  
  // ⚠️ CLAVE: Solo prevenir si es un bloque existente  
  if (!draggedId || !inspectorDrawer.document[draggedId]) {  
    // No es un bloque existente, NO prevenir - dejar que AddBlockButton lo maneje  
    return;  
  }  

  inspectorDrawer.debouncedSaveToHistory(); 
    
  // Solo ahora prevenimos el evento  
  event.preventDefault();  
  event.stopPropagation();  
  showContainerDropZone.value = false;  
    
  if (draggedId === currentBlockId) return;  
  if (dragAndDrop.isDescendant(currentBlockId, draggedId, inspectorDrawer.document)) return;  
    
  const target = event.target as HTMLElement;  
  const isOverChild = target.closest('[draggable="true"]') !== null;  
  if (isOverChild) return;  
    
  const nDocument = { ...inspectorDrawer.document };  
  const draggedBlock = dragAndDrop.removeBlockFromParent(nDocument, draggedId);  
  if (!draggedBlock) return;  
    
  const success = dragAndDrop.appendBlockToContainer(nDocument, draggedId, currentBlockId);  
  if (!success) return;  
    
  inspectorDrawer.setDocument(nDocument);  
}  
</script>