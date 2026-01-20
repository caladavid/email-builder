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
  modelValue: string | null | undefined,
}

defineProps<TextDimensionInputProps>()

// 🔥 CORRECCIÓN: El evento debe llamarse 'update:model-value' para que el padre lo escuche correctamente
const emit = defineEmits<{
  (e: 'update:model-value', args: string | null): void
}>()

function handleChange(newValue: string) {
  // Si está vacío o es "auto", devolver null
  if (!newValue || newValue.trim() === 'auto') {
    emit('update:model-value', null);
    return;
  }
  
  // Si ya tiene unidades (px, %, em, etc.), usarlo directamente
  if (/\d+(px|%|em|rem|vw|vh)$/.test(newValue.trim())) {
    emit('update:model-value', newValue.trim());
    return;
  }
  
  // Si es solo un número, agregar px
  const value = parseInt(newValue);
  const finalValue = isNaN(value) ? null : `${value}px`;
  
  emit('update:model-value', finalValue);
}
</script>