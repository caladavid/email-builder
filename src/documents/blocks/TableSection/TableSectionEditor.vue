<template>
  <component 
    :is="tagName"
    :id="htmlId"
    :class="className"
    :style="sectionStyles"
    data-block-type="TableSection"
  >
    <template v-for="childId in childrenIds" :key="childId">
        <EditorBlock :id="childId" /> 
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EditorBlock from '../../editor/EditorBlock.vue'; // Ajusta la ruta a tu componente EditorBlock
import type { TableSectionProps } from './TableSectionPropsSchema';

const props = defineProps<TableSectionProps>();

const childrenIds = computed(() => props.props?.childrenIds ?? []);
const tagName = computed(() => props.props?.tagName ?? 'tbody');
const htmlId = computed(() => props.props?.id);
const className = computed(() => props.props?.className);

const sectionStyles = computed(() => {
  // En el editor, a veces queremos agregar estilos visuales extra 
  // para que el usuario vea bloques vacíos (opcional)
  const s = props.style || {};
  return {
      ...s,
      // Si el tbody está vacío, le damos altura mínima para poder soltar cosas
      minHeight: childrenIds.value.length === 0 ? '50px' : undefined 
  };
});
</script>