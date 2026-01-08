<template>  
  <div>  
    <table :style="computedStyles" cellpadding="0" cellspacing="0" border="0">  
      <tbody>  
        <EditorChildrenIds :children-ids="childrenIds" />  
      </tbody>  
    </table>  
  </div>  
</template>  
  
<script setup lang="ts">  
import { computed } from 'vue';  
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue';  
import { TablePropsSchema, type TableProps } from './TablePropsSchema';  
  
const props = defineProps<TableProps>();  
  
const childrenIds = computed(() => props.props?.childrenIds ?? []);  
const computedStyles = computed(() => ({  
  ...props.style,  
  display: 'table',  
  width: props.style?.width || '100%'  
}));  
</script>