<template>
  <BaseContainer 
    :style="{
      ...props.style,
      // Forzamos que el contenedor sea un bloque de ancho completo
      width: props.style?.width || '100%',
      // Aseguramos que la alineación de texto afecte a los bloques hijos inline
      textAlign: props.style?.textAlign || 'inherit',
      ...(IS_DEBUG ? debugStyles : {})

    }"
    class="container-drop-zone"  
    @dragover="handleContainerDragOver"  
    @drop="handleContainerDrop" 
  >

  <div v-if="IS_DEBUG" class="debug-id-label" :title="currentBlockId">
      <span style="opacity: 0.7">ID:</span> {{ currentBlockId }}
    </div>

    <!-- <div class="debug-overlay"> 
      W: {{ props.style?.width || 'Auto' }}
      <br>
      Container
      <br>
      AlignAttr: [{{ props.style?.align || 'Vacío' }}] <br>
      
      TextAlign: [{{ props.style?.textAlign || 'Vacío' }}] <br>


    </div> -->

    <EditorChildrenIds
      :children-ids="props.props?.childrenIds ?? []"
      @change="handleUpdateChildrenIds"
    />
  </BaseContainer>
</template>

<script setup lang="ts">
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue';
import type { EditorChildrenChange } from '../helpers/EditorChildrenIds.vue';
/* import type { ContainerProps } from './ContainerPropsSchema'; */
import { currentBlockIdSymbol } from '../../editor/EditorBlock.vue';
import { useInspectorDrawer } from '../../editor/editor.store';
import { computed, inject, watch } from 'vue';
import { useDragAndDrop } from '../../../composables/useDragAndDrop';
import BaseContainer from '../../../components/BaseContainer.vue';
import type { ContainerProps } from '../../../lib/email-builder/blocks/Container';

/* defineProps<ContainerProps>() */
  const props = defineProps<ContainerProps>()
    /* console.log("props.style", props.style); */
const IS_DEBUG = false;
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

const debugStyles = {
  outline: '2px solid red',
  outlineOffset: '-2px', // Para que el borde sea interior y no rompa layout
  position: 'relative',   // Necesario para que la etiqueta se posicione absoluta a este bloque
  minHeight: '20px',      // TRUCO: Si el bloque está vacío (0px), esto lo fuerza a verse para que lo encuentres
  zIndex: 999
};

</script>

<style scoped>  
/* .container-drop-zone {
    position: relative;
    
    outline: 4px dashed rgba(0,0,0,0.1); 
} */

.debug-id-label {
  position: absolute;
  top: 0;
  left: 0;
  background-color: rgba(255, 0, 0, 0.9);
  color: white;
  font-family: monospace;
  font-size: 11px;
  padding: 2px 5px;
  z-index: 9999;
  pointer-events: none; /* CRÍTICO: Permite hacer click a través de la etiqueta */
  white-space: nowrap;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.2);
}

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