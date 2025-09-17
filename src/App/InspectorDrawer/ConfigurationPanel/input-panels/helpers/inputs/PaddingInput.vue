<template>
  <div class="space-y-2">
    <UFormField :label="label" />

    <RawSliderInput
      icon-label="material-symbols:align-vertical-top"
      :model-value="value.top"
      units="px"
      :step="4"
      :min="0"
      :max="80"
      @update:model-value="handleChange('top', $event)"
    />

    <RawSliderInput
      icon-label="material-symbols:align-vertical-bottom"
      :model-value="value.bottom"
      units="px"
      :step="4"
      :min="0"
      :max="80"
      @update:model-value="handleChange('bottom', $event)"
    />

    <RawSliderInput
      icon-label="material-symbols:align-horizontal-left"
      :model-value="value.left"
      units="px"
      :step="4"
      :min="0"
      :max="80"
      @update:model-value="handleChange('left', $event)"
    />

    <RawSliderInput
      icon-label="material-symbols:align-horizontal-right"
      :model-value="value.right"
      units="px"
      :step="4"
      :min="0"
      :max="80"
      @update:model-value="handleChange('right', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import RawSliderInput from './raw/RawSliderInput.vue';

type TPaddingValue = {
  top: number,
  right: number,
  bottom: number,
  left: number,
}
type Props = {
  label: string,
  modelValue: TPaddingValue | null,
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'change', args: TPaddingValue): void
}>()

/** Computed */

const value = computed(() => props.modelValue || {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

/** Functions */

function handleChange(internalName: keyof TPaddingValue, newValue: number) {
  const value = {
    ...props.modelValue as Required<TPaddingValue>,
    [internalName]: newValue,
  }

  emit('change', value)
} 
</script>
