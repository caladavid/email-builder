<template>
  <BaseSidebarPanel title="Bloque de columnas">
    <RadioGroupInput
      label="Numeros de columnas"
      :model-value="data.props?.columnsCount === 2 ? '2' : '3'"
      :items="[  
        { label: '2', value: '2' },   
        { label: '3', value: '3' },  
        { label: '4', value: '4' },  
        { label: '5', value: '5' },  
        { label: '6', value: '6' }  
      ]"
      @update:model-value="handleUpdateData({ ...data, props: { ...data.props, columnsCount: parseInt($event) } })"
    />
    <ColumnWidthsInput
      :columns-count="data.props?.columnsCount ?? 3"
      :model-value="data.props?.fixedWidths"
      @update:model-value="handleUpdateData({ ...data, props: { ...data.props, fixedWidths: $event } })"
    />
    <SliderInput
      label="Espacio entre columnas (gap)"
      icon-label="material-symbols:space-bar"
      units="px"
      :step="4"
      :min="0"
      :max="80"
      :default-value="data.props?.columnsGap ?? 0"
      @change="handleUpdateData({ ...data, props: { ...data.props, columnsGap: $event } })"
    />
    <RadioGroupInput
      label="Alineación"
      :model-value="data.props?.contentAlignment ?? 'middle'"
      :items="[
        { icon: 'material-symbols:vertical-align-top', value: 'top' },
        { icon: 'material-symbols:vertical-align-center', value: 'middle' },
        { icon: 'material-symbols:vertical-align-bottom', value: 'bottom' }
      ]"
      @update:model-value="handleUpdateData({ ...data, props: { ...data.props, contentAlignment: $event } })"
    />

    <MultiStylePropertyPanel
      :names="['backgroundColor', 'padding']"
      :model-value="data.style"
      @update:model-value="handleUpdateData({ ...data, style: $event })"
    />
  </BaseSidebarPanel>
</template>

<script setup lang="ts">
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';
import RadioGroupInput from './helpers/inputs/RadioGroupInput.vue';
import ColumnWidthsInput from './helpers/inputs/ColumnWidthsInput.vue';
import type { ColumnsContainerProps } from '../../../../documents/blocks/ColumnsContainer/ColumnsContainerPropsSchema'
import ColumnsContainerPropsSchema from '../../../../documents/blocks/ColumnsContainer/ColumnsContainerPropsSchema'
import SliderInput from './helpers/inputs/SliderInput.vue';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';
import { ref } from 'vue';

type ColumnsContainerSidebarPanelProps = {
  data: ColumnsContainerProps;
}

defineProps<ColumnsContainerSidebarPanelProps>()

const emit = defineEmits<{
  (e: 'update:data', args: ColumnsContainerProps): void
}>()

/** Refs */

const errors = ref<Zod.ZodError | null>(null)

/** Functions */

function handleUpdateData(data: unknown) {
  const res = ColumnsContainerPropsSchema.safeParse(data);

  if (res.success) {
    emit('update:data', res.data);
    errors.value = null;
  } else {
    errors.value = res.error;
  }
}
</script>
