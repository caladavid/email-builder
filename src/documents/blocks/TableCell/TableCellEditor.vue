<template>
    <td 
        :style="cellStyle" 
        :colspan="colspan" 
        :rowspan="rowspan"
        :align="align"
        :valign="valign"
        :width="widthAttr"
        data-type="TableCell"
    >
        <EditorChildrenIds :children-ids="childrenIds" />
    </td>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue';
import { TableCellPropsSchema, type TableCellProps } from './TableCellPropsSchema';

const props = defineProps<TableCellProps>();
const childrenIds = computed(() => props.props?.childrenIds ?? []);

// Props específicas de celda que extrajimos en el Parser
const colspan = computed(() => props.props?.colspan ?? 1);
const rowspan = computed(() => props.props?.rowspan ?? 1);
const align = computed(() => props.props?.align);
const valign = computed(() => props.props?.valign);
const widthAttr = computed(() => props.props?.width);

const cellStyle = computed(() => ({
    ...props.style
}));
</script>