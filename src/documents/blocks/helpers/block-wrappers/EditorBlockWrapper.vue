<template>
  <div
    :style="{
      position: 'relative',
      maxWidth: '100%',
      outlineOffset: '-1px',
      outline
    }"
    @mouseenter.stop="mouseInside = true"
    @mouseleave="mouseInside = false"
    @click.prevent.stop="handleClick"
  >
    <TuneMenu v-if="inspectorDrawer.selectedBlockId === currentBlockId" :block-id="currentBlockId" />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { currentBlockIdSymbol } from '../../../editor/EditorBlock.vue';
import TuneMenu from './TuneMenu.vue';
import { useInspectorDrawer } from '../../../editor/editor.store';
import { computed, inject, ref } from 'vue';

const inspectorDrawer = useInspectorDrawer()

/** Refs */

const mouseInside = ref(false)

/** Injections */

const currentBlockId = inject(currentBlockIdSymbol)!

/** Computed */

const outline = computed(() => {
  if (inspectorDrawer.selectedBlockId === currentBlockId)
    return '2px solid rgba(0, 121, 204, 1)'

  if (mouseInside.value)
    return '2px solid rgba(0, 121, 204, 0.3)'

  return undefined
})

function handleClick() {
  inspectorDrawer.setSelectedBlockId(currentBlockId)
}

defineOptions({
  inheritAttrs: false,
})
</script>
