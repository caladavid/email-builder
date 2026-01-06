<template>
  <component 
    :is="tagName"
    :id="htmlId"
    :class="className"
    :style="sectionStyles"
  >
    <template v-for="childId in childrenIds" :key="childId">
      <ReaderBlock :id="childId" :document="document" />
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReaderBlock from '../../Reader/ReaderBlock.vue'; // Asegura que la ruta sea correcta
import type { TableSectionProps } from '../../../../documents/blocks/TableSection/TableSectionPropsSchema';


// Definimos las props usando el Tipo que acabas de exportar
const props = defineProps<TableSectionProps & { document: any }>();

const childrenIds = computed(() => props.props?.childrenIds ?? []);
const tagName = computed(() => props.props?.tagName ?? 'tbody'); // Fallback seguro
const htmlId = computed(() => props.props?.id);
const className = computed(() => props.props?.className);

const sectionStyles = computed(() => {
  return props.style || {};
});
</script>