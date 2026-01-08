<template>  
  <EditorBlockWrapper>  
    <td :style="cellStyle" :colspan="colspan" :rowspan="rowspan" data-type="TableCell">  
      <EditorChildrenIds :children-ids="childrenIds" />  
    </td>  
  </EditorBlockWrapper>  
</template>  
  
<script setup lang="ts">  
import { computed } from 'vue';  
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue';  
import { TableCellPropsSchema, type TableCellProps } from './TableCellPropsSchema';  
  
const props = defineProps<TableCellProps>();  
const childrenIds = computed(() => props.props?.childrenIds ?? []);  
const colspan = computed(() => props.props?.colspan ?? 1);  
const rowspan = computed(() => props.props?.rowspan ?? 1);  
const cellStyle = computed(() => ({  
  ...props.style,  
  display: 'table-cell',  
  verticalAlign: props.style?.verticalAlign || 'top'  
}));  
</script>