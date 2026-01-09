<template>
  <div class="flex gap-1">
    <TextDimensionInput
      v-for="index in columnsCount"
      :label="`Column ${index}`"
      :model-value="currentValue?.[index - 1]"
      @update:model-value="setIndex(index - 1, $event)"
    />
  </div>
</template>

<script setup lang="ts">
import TextDimensionInput from './TextDimensionInput.vue';
import { computed } from 'vue';

type TWidthValue = number | null | undefined;
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
  console.log('🔍 ColumnWidthsInput - columnsCount:', props.columnsCount);  
  const defaultValue = Array.from({ length: props.columnsCount }, () => null);  
  return props.modelValue ?? defaultValue;  
})

/** Functions */

function setIndex(index: number, value: TWidthValue) {
  const nValue: FixedWidths = [...currentValue.value]
  nValue[index] = value;

  emit('update:model-value', nValue);
}
</script>
