<template>
  <div class="flex gap-1">
    <TextDimensionInput
      v-for="index in columnsCount"
      :key="index" 
      :label="`Column ${index}`"
      :model-value="currentValue?.[index - 1]"
      @update:model-value="setIndex(index - 1, $event)"
    />
  </div>
</template>

<script setup lang="ts">
import TextDimensionInput from './TextDimensionInput.vue';
import { computed } from 'vue';

type TWidthValue = string | null | undefined;
type FixedWidths = TWidthValue[]; 

type ColumnsLayoutInputProps = {
  columnsCount: number,
  modelValue: FixedWidths | null | undefined,
}

const props = defineProps<ColumnsLayoutInputProps>()

const emit = defineEmits<{
  (e: 'update:model-value', args: FixedWidths): void
}>()

/** Computed */
const currentValue = computed(() => {
  // Aseguramos que el array tenga el largo correcto llenando con null lo que falte
  const current = props.modelValue || [];
  if (current.length < props.columnsCount) {
     return [...current, ...Array(props.columnsCount - current.length).fill(null)];
  }
  return current.slice(0, props.columnsCount);
})

/** Functions */
function setIndex(index: number, value: TWidthValue) {
  console.log('🔧 ColumnWidthsInput - setIndex:', { index, value });
  
  // Creamos una copia del array actual (o uno nuevo si es null)
  const nValue: FixedWidths = [...currentValue.value];
  nValue[index] = value;

  console.log('📤 ColumnWidthsInput - Emitiendo Array:', nValue);
  emit('update:model-value', nValue);
}
</script>