<template>
  <BaseContainer 
    :style="props.style"
    class="container-drop-zone"  
    @dragover="handleContainerDragOver"  
    @drop="handleContainerDrop" 
  >

    <div class="debug-overlay"> 
      W: {{ props.style?.width || 'Auto' }}
      
      AlignAttr: [{{ props.style?.align || 'Vacío' }}] <br>
      
      TextAlign: [{{ props.style?.textAlign || 'Vacío' }}] <br>


      <!-- {{ props.style?.paddingTop ? `| P:${props.style.paddingTop}` : '' }} -->
    </div>

    <EditorChildrenIds
      :children-ids="props.props?.childrenIds ?? []"
      @change="handleUpdateChildrenIds"
    />
  </BaseContainer>
</template>

<script setup lang="ts">
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue';
import type { EditorChildrenChange } from '../helpers/EditorChildrenIds.vue';
import type { ContainerProps } from './ContainerPropsSchema';
import { currentBlockIdSymbol } from '../../editor/EditorBlock.vue';
import { useInspectorDrawer } from '../../editor/editor.store';
import { computed, inject } from 'vue';
import { useDragAndDrop } from '../../../composables/useDragAndDrop';
import BaseContainer from '../../../components/BaseContainer.vue';

/* defineProps<ContainerProps>() */
  const props = defineProps<ContainerProps>()
    /* console.log("props.style", props.style); */

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
      const currentChildrenIds = props?.props?.childrenIds ?? [];  
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

<style scoped>  
/* .container-drop-zone {
    position: relative;
    
    outline: 4px dashed rgba(0,0,0,0.1); 
} */

.container-debug {  
  position: relative;  
}  
  
.debug-overlay {  
  position: absolute;  
  top: 0;  
  right: 0;  
  background: red;  
  color: white;  
  padding: 2px 5px;  
  font-size: 10px;  
  z-index: 1000;  
}  
</style>