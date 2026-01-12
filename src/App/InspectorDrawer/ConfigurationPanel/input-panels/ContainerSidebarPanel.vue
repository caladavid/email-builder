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
import { ContainerPropsSchema } from '../../../../lib/email-builder/blocks/Container'; 
import type { ContainerProps } from '../../../../lib/email-builder/blocks/Container'; 
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';
import { ref } from 'vue';

type ContainerSidebarPanelProps = {
  data: ContainerProps;
}

/* defineProps<ContainerSidebarPanelProps>() */
const props = defineProps<ContainerSidebarPanelProps>()

const emit = defineEmits<{
  (e: 'update:data', args: ContainerProps): void
}>()

/** Refs */

const errors = ref<Zod.ZodError | null>(null)

/** Functions */

function handleUpdateData(data: ContainerProps) {
  // 1. Validación simple
  const res = ContainerPropsSchema.safeParse(data);

  if (res.success) {
    // 2. Fusión simple y segura
    // Nota: MultiStylePropertyPanel ya se encargó de que los números sean números y no arrays.
    const mergedData = { 
      ...props.data,         // Mantiene document, id, tagName
      ...res.data,           // Mantiene childrenIds nuevos
      style: { 
        ...(props.data.style || {}), // Estilos viejos
        ...(res.data.style || {})    // Estilos nuevos (padding, color, etc.)
      } 
    };

    // SIN DELETE, SIN UNDEFINED MANUAL. Deja que los datos fluyan.
    emit('update:data', mergedData);
    errors.value = null;
  } else {
    console.log('Error validación Container:', res.error);
    errors.value = res.error;
  }
}
</script>
