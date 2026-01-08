<template>  
  <table :style="computedStyles" cellpadding="0" cellspacing="0" border="0" role="presentation">  
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
  
const props = defineProps<TableProps & { document: Record<string, any> }>();  
  
const childrenIds = computed(() => props.props?.childrenIds ?? []);  
const computedStyles = computed(() => ({  
  ...props.style,  
  display: 'table',  
  width: props.style?.width || '100%'  
}));  
</script>