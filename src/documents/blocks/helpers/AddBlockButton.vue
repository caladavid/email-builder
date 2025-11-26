<template>
  <div
    class="z-20"
    :style="{
      position: placeholder ? 'relative' : 'absolute',
      height: placeholder ? 'auto' :  '10px',
      margin: '-5px 0',
      width: '100%',
    }"
    @mouseenter="visible = true"
    @mouseleave="visible = false"
  >
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

const props = defineProps<{
  placeholder?: boolean
}>()

defineEmits<{
  (e: 'select', args: TEditorBlock): void
}>()

/** Refs */

const visible = ref(false)
const open = ref(false)

/** Computed */

const buttonComponent = computed(() => {
  if (props.placeholder) {
    return PlaceholderButton
  }

  return DividerButton
})

/** Functions */

function handleMouseMove(e: MouseEvent) {
  const { clientX, clientY } = e;
  const buttonElement = e.target as HTMLElement

  const rect = buttonElement.getBoundingClientRect();
  const rectY = rect.y;
  const bottomX = rect.x;
  const topX = bottomX + rect.width;

  if (Math.abs(clientY - rectY) < 20) {
    if (bottomX < clientX && clientX < topX) {
      visible.value = true;
      return;
    }
  }

  visible.value = false;
}

/** Functions */
/* function handleButtonClick() {
  console.log('Botón clickeado. Estado de visibilidad:', visible.value);
  console.log('Estado de menú abierto:', open.value);
} */
</script>
