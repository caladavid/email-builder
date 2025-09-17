<template>
  <BaseSidebarPanel title="Bloque contenedor">
    <MultiStylePropertyPanel
      :names="['backgroundColor', 'borderColor', 'borderRadius', 'padding']"
      :model-value="data.style"
      @update:model-value="handleUpdateData({ ...data, style: $event })"
    />
  </BaseSidebarPanel>
</template>

<script setup lang="ts">
import ContainerPropsSchema from '../../../../documents/blocks/Container/ContainerPropsSchema';
import type { ContainerProps } from '../../../../documents/blocks/Container/ContainerPropsSchema';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';
import { ref } from 'vue';

type ContainerSidebarPanelProps = {
  data: ContainerProps;
}

defineProps<ContainerSidebarPanelProps>()

const emit = defineEmits<{
  (e: 'update:data', args: ContainerProps): void
}>()

/** Refs */

const errors = ref<Zod.ZodError | null>(null)

/** Functions */

function handleUpdateData(data: ContainerProps) {
  const res = ContainerPropsSchema.safeParse(data);

  if (res.success) {
    emit('update:data', res.data);
    errors.value = null;
  } else {
    errors.value = res.error;
  }
}
</script>
