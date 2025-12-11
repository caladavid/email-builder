<template>
  <BaseContainer 
    :style="style"
    class="container-drop-zone"  
    @dragover="handleContainerDragOver"  
    @drop="handleContainerDrop" 
  >
    <EditorChildrenIds
      :children-ids="props?.childrenIds ?? []"
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
import { inject } from 'vue';
import { useDragAndDrop } from '../../../composables/useDragAndDrop';

defineProps<ContainerProps>()

const inspectorDrawer = useInspectorDrawer();
const dragAndDrop = useDragAndDrop(() => currentBlockId);  

/** Injections */

const currentBlockId = inject(currentBlockIdSymbol) as string;

/** Functions */

function handleUpdateChildrenIds({ block, blockId, childrenIds }: EditorChildrenChange) {
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
  // Permitir drops en el área del contenedor  
  event.preventDefault();  
  dragAndDrop.handleDragOver(event);  
}  
  
function handleContainerDrop(event: DragEvent) {  
  event.preventDefault();  
    
  const draggedData = event.dataTransfer?.getData('text/plain');  
  if (!draggedData) return;  
    
  // Si es un nuevo bloque desde sidebar  
  if (draggedData?.startsWith('block-type:')) {  
    const blockType = draggedData.replace('block-type:', '');  
    const newBlock = dragAndDrop.createBlockFromType(blockType);  
      
    if (newBlock) {  
      const blockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;  
      const document = { ...inspectorDrawer.document };  
      document[blockId] = newBlock;  
        
      // Agregar al contenedor  
      const currentChildrenIds = props?.childrenIds ?? [];  
      inspectorDrawer.setDocument({  
        ...document,  
        [currentBlockId]: {  
          ...document[currentBlockId],  
          data: {  
            ...document[currentBlockId].data,  
            props: { childrenIds: [...currentChildrenIds, blockId] }  
          }  
        }  
      });  
    }  
  } else {  
    // Para bloques existentes, usar lógica normal  
    dragAndDrop.handleDrop(event);  
  }  
}  
</script>