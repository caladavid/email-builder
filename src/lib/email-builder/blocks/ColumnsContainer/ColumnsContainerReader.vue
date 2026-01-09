<template>
  <DynamicColumnsContainer :props="props.props" :style="style">
    
    <template 
      v-for="(column, index) in columns" 
      :key="index" 
      #[`column-${index}`]
    >
      <ReaderEditorChildrenIds 
        :children-ids="column?.childrenIds" 
        :document="document" 
      />
    </template>

  </DynamicColumnsContainer>
</template>

<script setup lang="ts">
import BaseColumnsContainer from '@flyhub/email-block-columns-container';
import ReaderEditorChildrenIds from '../../helpers/ReaderEditorChildrenIds.vue';
import type { ColumnsContainerProps } from './ColumnsContainerPropsSchema';
import { computed } from 'vue';
import DynamicColumnsContainer from '../../../../components/DynamicColumnsContainer.vue';

const props = defineProps<ColumnsContainerProps & { document: any }>()

/** Computed */

const columns = computed(() => props.props?.columns ?? []);
/* const restProps = computed(() => {
  const { columns: _, ...rest } = props.props ?? {}

  return rest
}) */
</script>
