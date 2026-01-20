<template>  
  <EditorBlockWrapper>  
    <tr 
      :style="[
        rowStyle, 
        IS_DEBUG ? { outline: '2px dashed blue', outlineOffset: '-2px', position: 'relative' } : {}
      ]" 
      data-type="TableRow"
    >  
      <td 
        :style="[cellStyle, IS_DEBUG ? { position: 'relative' } : {}]" 
        :align="alignAttribute"
      >
        <div v-if="IS_DEBUG" class="debug-row-label" :title="currentBlockId">
          ROW: {{ currentBlockId }}
        </div>

        <EditorChildrenIds :children-ids="childrenIds" />
      </td>  
    </tr>  
  </EditorBlockWrapper>  
</template>  
  
<script setup lang="ts">  
import { computed, inject } from 'vue'; // 🔥 Importar inject
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue';  
import { TableRowPropsSchema, type TableRowProps } from './TableRowPropsSchema';  
import { getCleanBlockStyle } from '../../../utils/blockStyleUtils';
import { currentBlockIdSymbol } from '../../editor/EditorBlock.vue'; // 🔥 Importar Symbol

// 🔥 DEBUG: Activar/Desactivar
const IS_DEBUG = true; 

// 🔥 DEBUG: Obtener ID actual
const currentBlockId = inject(currentBlockIdSymbol) as string;
  
const props = defineProps<TableRowProps>();  
const childrenIds = computed(() => props.props?.childrenIds ?? []);  

const rowStyle = computed(() => {
  return getCleanBlockStyle(props.style, {
    display: 'table-row',
    width: '100%',
    backgroundColor: null
  });
});

const cellStyle = computed(() => {
  const align = props.style?.textAlign || 'center'; 
  
  return {
    width: '100%',
    textAlign: align,
    verticalAlign: 'top',
    padding: props.style?.padding ? `${props.style.padding.top}px ${props.style.padding.right}px ${props.style.padding.bottom}px ${props.style.padding.left}px` : '0',
  };
});

const alignAttribute = computed(() => {
  return props.style?.textAlign || 'center';
});
</script>

<style scoped>
/* 🔥 DEBUG: Estilos de la etiqueta */
.debug-row-label {
  position: absolute;
  top: 0;
  left: 0;
  background-color: blue;
  color: white;
  font-family: monospace;
  font-size: 10px;
  padding: 1px 4px;
  z-index: 9999;
  pointer-events: none; /* Click a través */
  white-space: nowrap;
  opacity: 0.8;
}
</style>