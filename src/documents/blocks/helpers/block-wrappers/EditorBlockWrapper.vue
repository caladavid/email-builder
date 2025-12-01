<template>  
  <div  
    :draggable="true"  
    :style="{  
      position: 'relative',  
      maxWidth: '100%',  
      outlineOffset: '-1px',  
      outline,  
      opacity: dragAndDrop.isDragging.value ? 0.5 : 1,  
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // ✅ Transición suave  
      transform: getBlockTransform() 
    }"  
    @mouseenter.stop="mouseInside = true"    
    @mouseleave="mouseInside = false"    
    @click.prevent.stop="handleClick"      
    @dragstart.stop="handleDragStart"    
    @dragover="handleDragOver"      
    @dragleave="dragAndDrop.handleDragLeave"  
    @drop="handleDrop"    
    @dragend="dragAndDrop.handleDragEnd"       
  >  

    <!-- <DragHandle   
      v-if="isDraggable && (mouseInside || inspectorDrawer.selectedBlockId === currentBlockId)"   
      :block-id="currentBlockId"   
    /> -->

    <!-- ✅ Indicador mejorado con vista previa -->  
    <div     
      v-if="dragAndDrop.showDropIndicator.value && isDraggingFromSidebar()"     
      :style="dragAndDrop.dropIndicatorStyle.value"    
    >    
      <div v-if="getDraggedBlockPreview()" style="text-align: center;">    
        <UIcon :name="getDraggedBlockPreview()?.icon || ''" style="font-size: 24px; opacity: 0.6;" />    
        <div style="margin-top: 4px; font-size: 10px;">    
          {{ getDraggedBlockPreview()?.displayName }}    
        </div>    
      </div>    
    </div> 

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
import DragHandle from '../../DragHandle/DragHandle.vue';
import type { TEditorBlock } from '../../../editor/core';
import { BUTTONS } from '../buttons';
  
const inspectorDrawer = useInspectorDrawer();  
  
/** Refs */  
const mouseInside = ref(false);
const alwaysShowHandle = ref(false);  
const showDropIndicator = ref(false);  
  
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
/*   console.log('🎯 EditorBlockWrapper handleDrop llamado');   */
    
  if (!isDraggable.value) return;  
    
  event.preventDefault();  
  event.stopPropagation();  
    
  const draggedData = event.dataTransfer?.getData('text/plain');  
/*   console.log('📦 Datos recibidos:', draggedData);   */
    
  if (draggedData?.startsWith('block-type:')) {  
/*     console.log('✅ Bloque nuevo desde sidebar');   */
      
    // 🔧 CLAVE: Verificar si el target es un AddBlockButton  
    const target = event.target as HTMLElement;  
    const isAddBlockButton = target.closest('.add-block-button') ||   
                             target.closest('[class*="add-block"]');  
      
    if (isAddBlockButton) {  
/*       console.log('🔄 Reemplazando AddBlockButton');  */ 
      // Emitir evento replace para que EditorChildrenIds lo maneje  
      const blockType = draggedData.replace('block-type:', '');  
      const newBlock = dragAndDrop.createBlockFromType(blockType);  
        
      if (newBlock) {  
        // Buscar el AddBlockButton padre y emitir replace  
        const addButton = target.closest('[class*="add-block"]') as HTMLElement;  
        const addButtonComponent = (addButton as any).__vueParentComponent;  
        addButtonComponent?.emit('replace', newBlock);  
      }  
    } else {  
/*       console.log('➕ Insertando en bloque existente');   */
      // Insertar antes/después del bloque actual  
      const blockType = draggedData.replace('block-type:', '');  
      const newBlock = dragAndDrop.createBlockFromType(blockType);  
        
      if (newBlock) {  
        insertBlockAtCurrentPosition(newBlock);  
      }  
    }  
      
    return;  
  }  
    
  // Para bloques existentes, usar lógica normal  
  dragAndDrop.handleDrop(event);  
}

function insertBlockAtCurrentPosition(newBlock: TEditorBlock) {  
  const currentBlock = currentBlockId;  
  const nDocument = { ...inspectorDrawer.document };  
    
  // Agregar nuevo bloque al documento  
  const newBlockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;  
  nDocument[newBlockId] = newBlock;  
    
  // ✅ Usar la posición determinada por handleDragOver  
  const position = dragAndDrop.dropPosition.value; // 'before' o 'after'  
    
  const success = dragAndDrop.insertBlockAtPosition(  
    nDocument,  
    newBlockId,  
    currentBlock,  
    position // ✅ Usar posición real en lugar de 'before' hardcoded  
  );  
    
  if (success) {  
    inspectorDrawer.setDocument(nDocument);  
  }  
}

function handleDragOver(event: DragEvent) {  
/*   console.log('🎯 EditorBlockWrapper handleDragOver llamado');   */
    
/*   if (!event.dataTransfer) {  
    console.error('❌ dataTransfer no disponible');  
    return;  
  }   */
    
  // ✅ CLAVE: preventDefault() PRIMERO  
  event.preventDefault();  
    
  if (event.dataTransfer) {  
    event.dataTransfer.dropEffect = 'copy';  
  }  
    
  // ✅ AHORA obtener datos  
  const draggedData = event.dataTransfer?.getData('text/plain');  
/*   console.log('📦 Datos recibidos en EditorBlockWrapper:', draggedData);   */
    
  if (draggedData?.startsWith('block-type:')) {  
/*     console.log('✅ Es un bloque nuevo desde sidebar');   */
    showDropIndicator.value = true;  
    return;  
  }  
    
  // Para bloques existentes, usar lógica normal  
  dragAndDrop.handleDragOver(event);  
}    

function handleClick() {  
  inspectorDrawer.setSelectedBlockId(currentBlockId);  
} 

function getBlockPreview(): string {  
  const draggedData = dragAndDrop.draggedBlockId.value;  
  if (!draggedData?.startsWith('block-type:')) return '';  
    
  const blockType = draggedData.replace('block-type:', '');  
  const previews: Record<string, string> = {  
    'Encabezado': '📝 Título',  
    'Texto': '📄 Párrafo de texto',  
    'Botón': '🔘 Botón',  
    'Imagen': '🖼️ Imagen',  
    'Contenedor': '📦 Contenedor',  
    'Columnas': '📊 Columnas'  
  };  
    
  return previews[blockType] || `📦 ${blockType}`;  
}  
  
function isDraggingFromSidebar(): boolean {  
  return dragAndDrop.isDragging.value &&   
         dragAndDrop.draggedBlockId.value?.startsWith('block-type:') === true;  
}

function getDraggedBlockPreview() {  
  const draggedData = dragAndDrop.draggedBlockId.value;  

  if (!draggedData?.startsWith('block-type:')) {  
    return null;  
  }  

  if (draggedData?.startsWith('block-type:')) {  
    const blockType = draggedData.replace('block-type:', '');  
    const blockConfig = BUTTONS.find(b => b.label.toLowerCase() === blockType.toLowerCase());  
    if (blockConfig) {  
      return {  
        type: blockType,  
        icon: blockConfig.icon,  
        displayName: blockConfig.label  
      };  
    }  
  }  
  return null;  
}

function getBlockTransform() {  
  if (!dragAndDrop.showDropIndicator.value) return 'translateY(0)';  
    
  // Si el indicador está antes, desplazar hacia abajo  
  if (dragAndDrop.dropPosition.value === 'before') {  
    return 'translateY(20px)';  
  }  
    
  // Si el indicador está después, no desplazar este bloque  
  return 'translateY(0)';  
}
  
defineOptions({  
  inheritAttrs: false,  
});  
</script>

<style scoped>  
.drag-handle.always-visible {  
  opacity: 0.6;  
}  
  
.drag-handle.always-visible:hover {  
  opacity: 1;  
}  

.draggable-block {    
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);    
}    
    
/* ✅ Efecto hover para mejor feedback */  
.draggable-block:hover {  
  transform: translateY(0);  
}  
  
.draggable-block.drag-over-before {  
  transform: translateY(30px);  
}  
  
.draggable-block.drag-over-after {  
  transform: translateY(-30px);  
}  
</style>