<template>
  <template v-for="(name) in names" :key="name">
    <SingleStylePropertyPanel :name="name" :model-value="modelValue || {}" @update:model-value="$emit('update:model-value', $event)" />
  </template>
</template>

<script setup lang="ts">
import type { TStyle } from '../../../../../../documents/blocks/helpers/TStyle';
import SingleStylePropertyPanel from './SingleStylePropertyPanel.vue';

type MultiStylePropertyPanelProps = {
  names: (keyof TStyle)[],
  modelValue: TStyle | undefined | null,
}

defineProps<MultiStylePropertyPanelProps>()

defineEmits<{
  (e: 'update:model-value', args: TStyle): void
}>()
</script>
