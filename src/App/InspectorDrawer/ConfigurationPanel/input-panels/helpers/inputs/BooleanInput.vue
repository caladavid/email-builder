<template>
  <UFormField :label="label">
    <USwitch
      :model-value="modelValue"
      @update:model-value="$emit('update:model-value', $event)"
    />
  </UFormField>
</template>

<script setup lang="ts">
type BooleanInputProps = {
  label: string,
  modelValue: boolean,
}

defineProps<BooleanInputProps>()

defineEmits<{
  (e: 'update:model-value', args: boolean): void
}>()
</script>
