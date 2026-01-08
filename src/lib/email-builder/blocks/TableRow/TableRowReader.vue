<template>  
  <tr :style="rowStyle">  
    <template v-for="childId in childrenIds" :key="childId">  
      <ReaderBlock :id="childId" :document="document" />  
    </template>  
  </tr>  
</template>  
  
<script setup lang="ts">  
import { computed } from 'vue';  
import ReaderBlock from '../../Reader/ReaderBlock.vue';  
import type { TableRowProps } from './TableRowPropsSchema';  
  
const props = defineProps<TableRowProps & { document: Record<string, any> }>();  
const childrenIds = computed(() => props.props?.childrenIds ?? []);  
const rowStyle = computed(() => ({  
  ...props.style,  
  display: 'table-row'  
}));  
</script>