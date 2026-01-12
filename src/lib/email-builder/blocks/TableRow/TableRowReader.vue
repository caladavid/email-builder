<template>  
  <tr :style="rowStyle">  
    <td :style="cellStyle" :align="alignAttribute">
      <template v-for="childId in childrenIds" :key="childId">
        <ReaderBlock :id="childId" :document="document" />
      </template>
    </td>
  </tr>  
</template>  
  
<script setup lang="ts">  
import { computed } from 'vue';  
import ReaderBlock from '../../Reader/ReaderBlock.vue';  
import type { TableRowProps } from './TableRowPropsSchema';  
import { getCleanBlockStyle } from '../../../../utils/blockStyleUtils';
  
const props = defineProps<TableRowProps & { document: Record<string, any> }>();  
const childrenIds = computed(() => props.props?.childrenIds ?? []);  
const rowStyle = computed(() => {
  return getCleanBlockStyle(props.style, {
    display: 'table-row',
    width: '100%',
    backgroundColor: null
  });
});

const cellStyle = computed(() => {
  return {
    width: '100%',
    textAlign: props.style?.textAlign || 'center',
    verticalAlign: 'top',
    padding: props.style?.padding ? `${props.style.padding.top}px ${props.style.padding.right}px ${props.style.padding.bottom}px ${props.style.padding.left}px` : '0',
  };
});

const alignAttribute = computed(() => props.style?.textAlign || 'center');
</script>