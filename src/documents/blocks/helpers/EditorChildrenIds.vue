<template>
  <AddBlockButton v-if="!childrenIds?.length" placeholder @select="handleAppendBlock" />
  <template v-else>
    <template v-for="childId, i in childrenIds" :key="childId">
      <AddBlockButton @select="handleInsertBlock($event, i)" />
      <EditorBlock :id="childId" />
    </template>
    <AddBlockButton @select="handleAppendBlock($event)" />
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

type EditorChildrenIdsProps = {
  childrenIds: string[] | null | undefined
}

const emit = defineEmits<{
  (e: 'change', args: EditorChildrenChange): void
}>()

const props = defineProps<EditorChildrenIdsProps>()

/** Functions */

let idCounter = 0;
const generateId = () => `block-${Date.now()}-${++idCounter}`

function handleInsertBlock(block: TEditorBlock, index: number) {
  const blockId = generateId()
  const newChildrenIds = [...(props.childrenIds || [])]
  newChildrenIds.splice(index, 0, blockId)

  emit('change', {
    blockId,
    block,
    childrenIds: newChildrenIds
  })
}

function handleAppendBlock(block: TEditorBlock) {
  const blockId = generateId()

  emit('change', {
    blockId,
    block,
    childrenIds: [...(props.childrenIds || []), blockId]
  })
}
</script>
