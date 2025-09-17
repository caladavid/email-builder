<template>
  <UFormField :label="label">
    <UInput
      :model-value="modelValue"
      @update:model-value="handleChange($event as string)"
      placeholder="auto"
    >
      <template #trailing>
        px
      </template>
    </UInput>
  </UFormField>
</template>

<script setup lang="ts">
type TextDimensionInputProps = {
  label: string,
  modelValue: number | null | undefined,
}

defineProps<TextDimensionInputProps>()

const emit = defineEmits<{
  (e: 'change', args: number | null): void
}>()

/** Functions */

function handleChange(newValue: string) {
  const value = parseInt(newValue);
  emit('change', isNaN(value) ? null : value);
}
</script>
