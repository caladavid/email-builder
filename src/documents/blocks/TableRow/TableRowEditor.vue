<template>
    <tr :style="rowStyle" data-type="TableRow">
        <EditorChildrenIds :children-ids="childrenIds" />
    </tr>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue';
import { TableRowPropsSchema, type TableRowProps } from './TableRowPropsSchema';

const props = defineProps<TableRowProps>();
const childrenIds = computed(() => props.props?.childrenIds ?? []);

const rowStyle = computed(() => ({
    ...props.style
}));
</script>