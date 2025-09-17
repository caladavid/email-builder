<template>
  <RadioGroupInput
    :label="label"
    :model-value="modelValue ?? 'left'"
    :items="[
      { icon: 'material-symbols:format-align-left', value: 'left' },
      { icon: 'material-symbols:format-align-center', value: 'center' },
      { icon: 'material-symbols:format-align-right', value: 'right' },
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
