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
      transform: getBlockTransform() ,  
      cursor: getCursorStyle()
    }"  
    @mouseenter.stop="mouseInside = true"
    @mouseleave="handleMouseLeave"     
    @mousemove="handleMouseMove" 
    @click.prevent.stop="handleClick"      
    @dragstart.stop="handleDragStart"    
    @dragover="handleDragOver"      
    @dragleave="dragAndDrop.handleDragLeave"  
    @drop="handleDrop"    
    @dragend="dragAndDrop.handleDragEnd"       
    >  
<!--     @mouseleave="mouseInside = false"  -->  
     

    <!-- ✅ Indicador mejorado con vista previa -->  
<!--     <div     
      v-if="dragAndDrop.showDropIndicator.value && isDraggingFromSidebar()"     
      :style="dragAndDrop.dropIndicatorStyle.value"    
    >    
      <div v-if="getDraggedBlockPreview()" style="text-align: center;">    
        <UIcon :name="getDraggedBlockPreview()?.icon || ''" style="font-size: 24px; opacity: 0.6;" />    
        <div style="margin-top: 4px; font-size: 10px;">    
          {{ getDraggedBlockPreview()?.displayName }}    
        </div>    
      </div>    
    </div>  -->

    <div       
      v-if="dragAndDrop.showDropIndicator.value"       
      :style="dragAndDrop.dropIndicatorStyle.value"      
    >      
      <div v-if="isDraggingFromSidebar() && getDraggedBlockPreview()" style="text-align: center;">      
        <UIcon :name="getDraggedBlockPreview()?.icon || ''" style="font-size: 24px; opacity: 0.6;" />      
        <div style="margin-top: 4px; font-size: 10px;">      
          {{ getDraggedBlockPreview()?.displayName }}      
        </div>      
      </div>      
    </div>

    <!-- <div v-if="dragAndDrop.showDropIndicator.value" :style="dragAndDrop.dropIndicatorStyle.value" />   -->
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
let edgeThresholdPixel = 16;  

  
/** Refs */  
const mouseInside = ref(false);
const showDropIndicator = ref(false);  
const isNearDragEdge = ref(false);
  
/** Injections */  
const currentBlockId = inject(currentBlockIdSymbol)!;  
  
/** Composables */  
const dragAndDrop = useDragAndDrop(() => currentBlockId);   
  
/** Computed */  
const outline = computed(() => {  
  /* const block = inspectorDrawer.document[currentBlockId];
  if (!block || !isLeafBlock(block)) return undefined */
  
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

  const currentBlock = inspectorDrawer.document[currentBlockId];  
  const isTextBlock = currentBlock?.type === "Text";
  const isHeadingBlock = currentBlock?.type === "Heading";

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();  
  const x = event.clientX - rect.left;  
  const y = event.clientY - rect.top;  
  const edgeThreshold = edgeThresholdPixel;  
    
  const isNearEdge = x <= edgeThreshold ||   
                    x >= rect.width - edgeThreshold ||   
                    y <= edgeThreshold ||   
                    y >= rect.height - edgeThreshold;  

  if (!isNearEdge) {  
    event.preventDefault();  
    return;  
  }  
/*   if (isTextBlock || isHeadingBlock) {  
  }  
   */
  dragAndDrop.handleDragStart(event);  
}  

/* function handleMouseDown(event: MouseEvent){
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();  
  const x = event.clientX - rect.left;  
  const y = event.clientY - rect.top;  
  const edgeThreshold = edgeThresholdPixel;  
    
  const isNearEdge = x <= edgeThreshold ||   
                    x >= rect.width - edgeThreshold ||   
                    y <= edgeThreshold ||   
                    y >= rect.height - edgeThreshold;

  if (isNearEdge){
    // Habilitar drag solo para este evento  
    (event.currentTarget as HTMLElement).draggable = true;
    setTimeout(() => {
      const dragEvent = new DragEvent("dragstart", {
        bubbles: true,
        cancelable: true,
      });
      (event.currentTarget as HTMLElement).dispatchEvent(dragEvent)
    }, 0);
  } else {
    (event.currentTarget as HTMLElement).draggable = false;
  }
} */
  
function handleDrop(event: DragEvent) {    
  if (!isDraggable.value) return;    
      
  event.preventDefault();    
  event.stopPropagation();  
  
  // Solo permitir drop si el preview está visible  
  if (!dragAndDrop.showDropIndicator.value) {  
    console.log('❌ Drop bloqueado - no hay preview visible');  
    return;  
  }  

  // VALIDACIÓN ADICION: Verificar posición válida  
  if (dragAndDrop.dropPosition.value !== 'before' &&   
      dragAndDrop.dropPosition.value !== 'after' &&   
      dragAndDrop.dropPosition.value !== 'center') {  
    console.log('❌ Drop bloqueado - posición inválida');  
    return;  
  }  
      
  const draggedData = event.dataTransfer?.getData('text/plain');    
  const target = event.target as HTMLElement;    
  const isAddBlockButton = target.closest('.add-block-button') ||   
                           target.closest('[class*="add-block"]') ||  
                           target.closest('[data-add-block]'); 
                           
                           
      
  // ✅ Si el target es AddBlockButton, SIEMPRE reemplazar  
  if (isAddBlockButton) {  
    console.log('🔄 Reemplazando AddBlockButton con:', draggedData);  
      
    let blockToInsert: TEditorBlock | null = null;  
      
    if (draggedData?.startsWith('block-type:')) {  
      // Bloque nuevo desde sidebar  
      const blockType = draggedData.replace('block-type:', '');  
      blockToInsert = dragAndDrop.createBlockFromType(blockType);  
    } else if (draggedData && inspectorDrawer.document[draggedData]) {  
      // Bloque existente - usar el bloque directamente  
      blockToInsert = inspectorDrawer.document[draggedData];  
        
      // Remover de su posición original  
      const nDocument = { ...inspectorDrawer.document };  
      dragAndDrop.removeBlockFromParent(nDocument, draggedData);  
      inspectorDrawer.setDocument(nDocument);  
    }  
      
    if (blockToInsert) {  
      // Emitir evento replace para AddBlockButton  
      let addButton = target.closest('.add-block-button') as HTMLElement ||  
                            target.closest('[class*="add-block"]') as HTMLElement ||  
                            target.closest('[data-add-block]') as HTMLElement; 
                            
      if (addButton){
        const addButtonComponent = ( addButton as any).__vueParentComponent;  
        addButtonComponent?.emit('replace', blockToInsert);  
      }
      
    }  
      
    return;  
  }  
      
  // Para otros targets, usar lógica normal  
  if (draggedData?.startsWith('block-type:')) {  
    // Bloques nuevos del sidebar  
    const blockType = draggedData.replace('block-type:', '');  
    const newBlock = dragAndDrop.createBlockFromType(blockType);  
      
    if (newBlock) {  
      insertBlockAtCurrentPosition(newBlock);  
    }  
  } else if (draggedData && inspectorDrawer.document[draggedData]) {  
    // Bloques existentes  
    const targetId = currentBlockId;  
      
    if (draggedData === targetId) {  
      console.log('❌ No se puede soltar sobre sí mismo');  
      return;  
    }  
      
    if (dragAndDrop.isDescendant(targetId, draggedData, inspectorDrawer.document)) {  
      console.log('❌ Es un descendiente, no permitido');  
      return;  
    }  
      
    console.log('✅ Ejecutando moveBlock');  
    dragAndDrop.moveBlock(draggedData, targetId, dragAndDrop.dropPosition.value);  
  }  
}

function handleMouseLeave() {  
  mouseInside.value = false;  
  isNearDragEdge.value = false;  
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
  event.preventDefault();  
    
  if (event.dataTransfer) {  
    event.dataTransfer.dropEffect = 'copy';  
  }  
    
  const draggedData = event.dataTransfer?.getData('text/plain');  
    
  // ✅ Detección mejorada de anidamiento  
  const target = event.target as HTMLElement;  
  const currentWrapper = event.currentTarget as HTMLElement;  
    
  // Encontrar si hay un wrapper hijo más específico  
  const childWrapper = target.closest('.editor-block-wrapper');  
    
  // Si hay un wrapper hijo y no es el actual, dejar que el hijo maneje el evento  
  if (childWrapper && childWrapper !== currentWrapper && currentWrapper.contains(childWrapper)) {  
    showDropIndicator.value = false;  
    return;  
  }  
    
  if (draggedData?.startsWith('block-type:')) {  
    showDropIndicator.value = true;  
    return;  
  }  
    
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

  // Si el indicador está en centro, no desplazar (es para agregar al contenedor)  
  if (dragAndDrop.dropPosition.value === 'center') {  
    return 'translateY(0)';  
  } 
    
  // Si el indicador está después, no desplazar este bloque  
  return 'translateY(0)';  
}

/* function getBlockTransform() {    
  if (!dragAndDrop.showDropIndicator.value) return 'translateY(0)';    
      
  // ✅ Calcular dinámicamente según el tamaño del bloque  
  const currentBlock = inspectorDrawer.document[currentBlockId];  
  const blockHeight = currentBlock ? calculateBlockHeight(currentBlock) : 20;  
    
  if (dragAndDrop.dropPosition.value === 'before') {    
    return `translateY(${Math.min(blockHeight, 40)}px)`;    
  }    
      
  return 'translateY(0)';    
}   */
  
function calculateBlockHeight(block: TEditorBlock): number {  
  // Lógica para calcular altura real según tipo de bloque  
  const heights: Record<string, number> = {  
    'Heading': 40,  
    'Text': 30,  
    'Button': 35,  
    'Image': 50,  
    'Container': 60,  
    'ColumnsContainer': 80  
  };  
    
  return heights[block.type] || 20;  
} 
  
// Computed para el cursor preciso  
const getCursorStyle = () => {  
  const currentBlock = inspectorDrawer.document[currentBlockId];  
  const isTextBlock = currentBlock?.type === 'Text';  
  const isHeadingBlock = currentBlock?.type === "Heading";
    
  if ((isTextBlock || isHeadingBlock) && isNearDragEdge.value) {  
    return 'grab';  
  }  
    
  // Para bloques de texto, usar cursor de texto por defecto  
  if (isTextBlock || isHeadingBlock) {  
    return 'text';  
  }  
    
  return 'grab';  
};  

function handleMouseMove(event: MouseEvent) {  
  const currentBlock = inspectorDrawer.document[currentBlockId];  
  const isTextBlock = currentBlock?.type === 'Text';  
  const isHeadingBlock = currentBlock?.type === "Heading";
  
  if (isTextBlock || isHeadingBlock) {  
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();  
    const x = event.clientX - rect.left;  
    const y = event.clientY - rect.top;  
    const edgeThreshold = edgeThresholdPixel;  
      
    const nearEdge = x <= edgeThreshold ||   
                    x >= rect.width - edgeThreshold ||   
                    y <= edgeThreshold ||   
                    y >= rect.height - edgeThreshold;  
      
    isNearDragEdge.value = nearEdge;  
  } else {  
    isNearDragEdge.value = false;  
  }  
}

function isLeafBlock(block: TEditorBlock): boolean{
  // Los bloques de contenido siempre son hojas  
  const contentTypes = ['Text', 'Heading', 'Button', 'Image', 'Avatar', 'Divider', 'Spacer', 'Html'];  
  if (!contentTypes.includes(block.type)) return true;

  // Los contenedores son hojas solo si no tienen hijos  
  if (block.type === 'Container') {  
    return !block.data.props?.childrenIds || block.data.props.childrenIds.length === 0;  
  }  
    
  if (block.type === 'ColumnsContainer') {  
    return !block.data.props?.columns ||   
           block.data.props.columns.every(col => !col.childrenIds || col.childrenIds.length === 0);  
  }  
    
  if (block.type === 'EmailLayout') {  
    return !block.data.childrenIds || block.data.childrenIds.length === 0;  
  }  

  return false;
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