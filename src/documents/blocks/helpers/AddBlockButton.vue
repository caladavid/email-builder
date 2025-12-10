<template>
  <div
    class="z-20"
    :style="{
      position: placeholder ? 'relative' : 'absolute',
      height: placeholder ? 'auto' :  '10px',
      margin: '-5px 0',
      width: '100%',
    }"
    data-add-block="true"
    @mouseenter="visible = true"
    @mouseleave="visible = false"
    @dragover="handleDragOver"
    @drop="handleDrop"
    @dragleave="handleDragLeave"
  >

    <div v-if="showDropZone" :style="dropZoneStyle">
      <div :style="dropZoneTextStyle">
        Suelta para reemplazar
      </div>
    </div>

    <BlocksMenu v-if="placeholder || visible || open" @select="$emit('select', $event)" @update:open="open = $event">
      <component :is="buttonComponent" />
    </BlocksMenu>
  </div>
</template>

<script setup lang="ts">
import type { TEditorBlock } from '../../editor/core';
import PlaceholderButton from './PlaceholderButton.vue';
import DividerButton from './DividerButton.vue';
import BlocksMenu from './BlocksMenu.vue';
import { ref, computed } from 'vue'
import { BUTTONS } from './buttons';


const props = defineProps<{
  placeholder?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', args: TEditorBlock): void
  (e: 'replace', args: TEditorBlock): void
}>()

/** Refs */

const visible = ref(false)
const open = ref(false)
const showDropZone = ref(false)

/** Computed */

const buttonComponent = computed(() => {
  if (props.placeholder) {
    return PlaceholderButton
  }

  return DividerButton
})

const dropZoneStyle = {  
  position: 'absolute' as const,  
  top: 0,  
  left: 0,  
  right: 0,  
  bottom: 0,  
  backgroundColor: 'rgba(0, 121, 204, 0.1)',  
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

/** Functions */
function handleDragOver(event: DragEvent) {    
/*   console.log('🎯 AddBlockButton handleDragOver llamado');   */  
    
/*   if (!event.dataTransfer) {    
    console.error('❌ dataTransfer no disponible en dragover');    
    return;    
  }    */ 
  
  // ✅ CLAVE: Lamar preventDefault() PRIMERO  
  event.preventDefault();  
    
  if (event.dataTransfer) {    
    event.dataTransfer.dropEffect = 'copy';    
  }    
    
  // ✅ AHORA los datos deberían estar disponibles  
  const draggedData = event.dataTransfer?.getData('text/plain');    
  /* console.log('📦 Datos recibidos en AddBlockButton:', draggedData); */    
      
  if (draggedData?.startsWith('block-type:')) {    
    /* console.log('✅ Es un bloque nuevo desde sidebar');     */
    showDropZone.value = true;    
    return;    
  }    
      
  /* console.log('❌ No es un bloque block-type:');  */   
} 
  
function handleDrop(event: DragEvent) {  
  /* console.log('🎯 AddBlockButton handleDrop llamado');   */
  const draggedData = event.dataTransfer?.getData('text/plain');  
  /* console.log('📦 Datos en drop:', draggedData);   */
    
  if (draggedData?.startsWith('block-type:')) {  
    event.preventDefault();  
    event.stopPropagation();  
      
    const blockType = draggedData.replace('block-type:', '');  
    /* console.log('🔧 Tipo de bloque a crear:', blockType);  */ 
      
    const blockConfig = BUTTONS.find(b => b.label.toLowerCase() === blockType.toLowerCase());  
    /* console.log('🔍 BlockConfig encontrado:', blockConfig);  */ 
      
    if (blockConfig) {  
      const newBlock = blockConfig.block();  
     /*  console.log('🏗️ Bloque creado:', newBlock); */  
      emit('replace', newBlock);  
    } else {  
      console.log('❌ No se encontró configuración para:', blockType);  
    }  
  }  
    
  showDropZone.value = false;  
}  
  
function handleDragLeave(event: DragEvent) {  
  /* console.log('🎯 AddBlockButton handleDragLeave llamado'); */  
  const relatedTarget = event.relatedTarget as HTMLElement;  
  const currentTarget = event.currentTarget as HTMLElement;  
  
  if (!currentTarget.contains(relatedTarget)) {    
    /* console.log('👋 Saliendo del área de drop'); */  
    showDropZone.value = false;    
  }    
}  
</script>
