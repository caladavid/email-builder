<template>  
  <EditorBlockWrapper>  
    <tr :style="rowStyle" data-type="TableRow">  
      <td :style="cellStyle" :align="alignAttribute">
        <EditorChildrenIds :children-ids="childrenIds" />
      </td>  
    </tr>  
  </EditorBlockWrapper>  
</template>  
  
<script setup lang="ts">  
import { computed } from 'vue';  
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue';  
import { TableRowPropsSchema, type TableRowProps } from './TableRowPropsSchema';  
import { getCleanBlockStyle } from '../../../utils/blockStyleUtils';
  
const props = defineProps<TableRowProps>();  
const childrenIds = computed(() => props.props?.childrenIds ?? []);  
const rowStyle = computed(() => {
  // Limpiamos estilos zombis, pero row solo necesita ser table-row
  return getCleanBlockStyle(props.style, {
    display: 'table-row',
    width: '100%',
    backgroundColor: null
  });
});

const cellStyle = computed(() => {
  const align = props.style?.textAlign || 'center'; // Default center
  
  return {
    width: '100%',
    // La alineación CSS
    textAlign: align,
    verticalAlign: 'top',
    // Si tienes padding en el row, pásalo a la celda para mejor soporte
    padding: props.style?.padding ? `${props.style.padding.top}px ${props.style.padding.right}px ${props.style.padding.bottom}px ${props.style.padding.left}px` : '0',
  };
});

// 3. Atributo HTML align (Para Outlook viejo)
const alignAttribute = computed(() => {
  return props.style?.textAlign || 'center';
});
</script>