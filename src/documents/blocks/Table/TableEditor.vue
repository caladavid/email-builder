<template>
  <EditorBlockWrapper>
    <table
      :style="computedStyles"
      cellpadding="0"
      cellspacing="0"
      :align="align"
      :cellpadding="cellpadding"
      :cellspacing="cellspacing"
      :border="border"
    >
      <tbody>
        <EditorChildrenIds :children-ids="childrenIds" />
      </tbody>
    </table>
  </EditorBlockWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EditorBlockWrapper from '../helpers/block-wrappers/EditorBlockWrapper.vue';
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue'; // Asegúrate de importar esto
import { TablePropsSchema, type TableProps } from './TablePropsSchema';

const props = defineProps<TableProps>();

const childrenIds = computed(() => props.props?.childrenIds ?? []);

const align = computed(() => props.props?.align); // Ya no forzamos 'center'
const cellpadding = computed(() => props.props?.cellpadding ?? '0');
const cellspacing = computed(() => props.props?.cellspacing ?? '0');
const border = computed(() => props.props?.border ?? '0');

const computedStyles = computed(() => {
  const s = props.style || {};
  return {
    ...s // Los estilos del parser tienen prioridad
  };
});

</script>