<template>
  <RadioGroupInput
    :label="label"
    :model-value="modelValue"
    :items="[
      { label: 'Normal', value: 'normal' },
      { label: 'Negrita', value: 'bold' },
    ]"
    @update:model-value="$emit('change', $event)"
  />
</template>

<script setup lang="ts">
import RadioGroupInput from './RadioGroupInput.vue';

type Props = {
  label: string,
  modelValue: string | null,
}

defineProps<Props>()

defineEmits<{
  (e: 'change', args: string): void
}>()
</script>
