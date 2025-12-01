<template>
  <AddBlockButton v-if="!childrenIds?.length" placeholder @select="handleAppendBlock" @replace="handleReplaceBlock" />
  <template v-else>
    <template v-for="childId, i in childrenIds" :key="childId">
      <AddBlockButton @select="handleInsertBlock($event, i)" @replace="handleReplaceBlock($event, i)" />
      <EditorBlock :id="childId" />
    </template>
    <AddBlockButton @select="handleAppendBlock($event)" @replace="handleReplaceBlock($event)" />
  </template>
</template>

<script lang="ts">
export type EditorChildrenChange = {
  block: TEditorBlock,
  blockId: string,
  childrenIds: string[]
}
</script>

<script setup lang="ts">
import type { TEditorBlock } from '../../editor/core';
import AddBlockButton from './AddBlockButton.vue';
import EditorBlock from '../../editor/EditorBlock.vue';
import { useInspectorDrawer } from '../../editor/editor.store';

type EditorChildrenIdsProps = {
  childrenIds: string[] | null | undefined
}

const emit = defineEmits<{
  (e: 'change', args: EditorChildrenChange): void
}>()

const props = defineProps<EditorChildrenIdsProps>()
const editorStore = useInspectorDrawer()

/** Functions */

let idCounter = 0;
const generateId = () => `block-${Date.now()}-${++idCounter}`

function handleInsertBlock(block: TEditorBlock, index: number) {
  editorStore.debouncedSaveToHistory();

  const blockId = generateId();
  const newChildrenIds = [...(props.childrenIds || [])]
  newChildrenIds.splice(index, 0, blockId)

  emit('change', {
    blockId,
    block,
    childrenIds: newChildrenIds
  })
}

function handleAppendBlock(block: TEditorBlock) {
  editorStore.debouncedSaveToHistory();

  const blockId = generateId();

  emit('change', {
    blockId,
    block,
    childrenIds: [...(props.childrenIds || []), blockId]
  })
}

function handleReplaceBlock(block: TEditorBlock, index?: number) {  
/*   console.log('🔄 EditorChildrenIds handleReplaceBlock llamado');  
  console.log('📦 Bloque a reemplazar:', block);  */ 
  editorStore.debouncedSaveToHistory();  
  const blockId = generateId();  

 /*  console.log('🆔 Nuevo blockId:', blockId);  
  console.log('📝 Emitiendo cambio con:', { blockId, block, childrenIds: [blockId] });   */
    
  if (index !== undefined) {  
    // Reemplazar bloque específico en posición  
    const newChildrenIds = [...(props.childrenIds || [])];  
    newChildrenIds[index] = blockId;  
      
    emit('change', {  
      blockId,  
      block,  
      childrenIds: newChildrenIds  
    });  
  } else {  
    // Reemplazar todo (solo para placeholder)  
    emit('change', {  
      blockId,  
      block,  
      childrenIds: [blockId]  
    });  
  }  
}
</script>
