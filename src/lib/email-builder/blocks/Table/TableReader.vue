<template>
  <table
    :style="tableStyles"
    :align="align"
    :cellpadding="cellpadding"
    :cellspacing="cellspacing"
    :border="border"
    role="presentation"
  >
    <tbody>
      <template v-for="childId in childrenIds" :key="childId">
        <ReaderBlock :id="childId" :document="document" />
      </template>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReaderBlock from '../../Reader/ReaderBlock.vue';
import type { TableProps } from './TablePropsSchema';

const props = defineProps<TableProps & { document: any }>();

const childrenIds = computed(() => props.props?.childrenIds ?? []);

// Nuevos atributos que tu Matcher estricto ahora captura
const align = computed(() => props.props?.align); // Ya no forzamos 'center'
const cellpadding = computed(() => props.props?.cellpadding ?? '0');
const cellspacing = computed(() => props.props?.cellspacing ?? '0');
const border = computed(() => props.props?.border ?? '0');

const tableStyles = computed(() => {
  const s = props.style || {};
  return {
    ...s // Los estilos del parser tienen prioridad
  };
});
</script>