<template>
  <UPopover v-model:open="open" arrow>
    <slot />

    <template #content>
      <div class="grid grid-cols-4 p-2">
        <BlockButton
          v-for="item in BUTTONS"
          :label="item.label"
          :icon="item.icon"
          @click="handleClick(item)"
        />
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import type { TEditorBlock } from '../../editor/core';
import { BUTTONS } from './buttons';
import BlockButton from './BlockButton.vue';
import { ref, watch } from 'vue';

const open = ref(false)

const emit = defineEmits<{
  (e: 'select', args: TEditorBlock): void
  (e: 'open', args: boolean): void
}>()

/** Functions */

function handleClick(item: typeof BUTTONS[number]) {
  const block = item.block()
  emit('select', block);
  open.value = false;
}

/** Watch */

watch(open, (newValue, oldValue) => {
  // Evita hacer cálculos innecesarios si el estado no ha cambiado
  if (newValue !== oldValue) {
    /* console.log(`Estado 'open' cambiado: de ${oldValue} a ${newValue}`); */
    emit('open', newValue);
  }
});

</script>
