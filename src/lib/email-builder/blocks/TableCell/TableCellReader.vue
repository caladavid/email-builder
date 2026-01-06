<template>
  <component
    :is="tagName"
    :style="cellStyle"
    :colspan="colspan"
    :rowspan="rowspan"
    :align="align"
    :valign="valign"
    :width="widthAttr"
  >
    <template v-for="childId in childrenIds" :key="childId">
      <ReaderBlock :id="childId" :document="document" />
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReaderBlock from '../../Reader/ReaderBlock.vue';
import type { TableCellProps } from './TableCellPropsSchema';

const props = defineProps<TableCellProps & { document: any }>();

const childrenIds = computed(() => props.props?.childrenIds ?? []);
const colspan = computed(() => props.props?.colspan ?? 1);
const rowspan = computed(() => props.props?.rowspan ?? 1);
const align = computed(() => props.props?.align);
const valign = computed(() => props.props?.valign);
const widthAttr = computed(() => props.props?.width);

// Si el parser guardó "tagName": "th", lo usamos. Si no, "td".
const tagName = computed(() => props.props?.tagName ?? 'td');

const cellStyle = computed(() => {
  return props.style || {}; // Sin estilos forzados, pura fidelidad.
});
</script>