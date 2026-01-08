<template>  
  <component :is="tagName" :style="cellStyle" :colspan="colspan" :rowspan="rowspan">  
    <template v-for="childId in childrenIds" :key="childId">  
      <ReaderBlock :id="childId" :document="document" />  
    </template>  
  </component>  
</template>  
  
<script setup lang="ts">  
import { computed } from 'vue';  
import ReaderBlock from '../../Reader/ReaderBlock.vue';  
import type { TableCellProps } from './TableCellPropsSchema';  
  
const props = defineProps<TableCellProps & { document: Record<string, any> }>();  
const childrenIds = computed(() => props.props?.childrenIds ?? []);  
const colspan = computed(() => props.props?.colspan ?? 1);  
const rowspan = computed(() => props.props?.rowspan ?? 1);  
const tagName = computed(() => props.props?.tagName ?? 'td');  
const cellStyle = computed(() => ({  
  ...props.style,  
  display: 'table-cell',  
  verticalAlign: props.style?.verticalAlign || 'top'  
}));  
</script>