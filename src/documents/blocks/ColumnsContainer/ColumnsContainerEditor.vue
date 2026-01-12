<template>
  <DynamicColumnsContainer
    :props="props.props"
    :style="style"
  >
    <template 
      v-for="(_col, index) in columnsValue" 
      :key="index" 
      #[`column-${index}`]
    >
      <EditorChildrenIds 
        :children-ids="columnsValue[index]?.childrenIds" 
        @change="handleUpdateColumns(index, $event)" 
      />
    </template>
  </DynamicColumnsContainer>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import BaseColumnsContainer from '@flyhub/email-block-columns-container';
import ColumnsContainerPropsSchema from './ColumnsContainerPropsSchema';
import type { ColumnsContainerProps } from './ColumnsContainerPropsSchema';
import { currentBlockIdSymbol } from '../../editor/EditorBlock.vue';
import { useInspectorDrawer } from '../../editor/editor.store';
import type { EditorChildrenChange } from '../helpers/EditorChildrenIds.vue';
import EditorChildrenIds from '../helpers/EditorChildrenIds.vue';
import DynamicColumnsContainer from '../../../components/DynamicColumnsContainer.vue';

const props = defineProps<ColumnsContainerProps>()

// Inicializamos 8 columnas vacías por seguridad para el fallback
const EMPTY_COLUMNS = Array.from({ length: 8 }, () => ({ childrenIds: [] }));

const inspectorDrawer = useInspectorDrawer()

/** Injections */

const currentBlockId = inject(currentBlockIdSymbol)!

/** Computed */

// Calculamos las columnas reales o usamos el fallback
const columnsValue = computed(() => props.props?.columns ?? EMPTY_COLUMNS.slice(0, props.props?.columnsCount ?? 2))

// Extraemos el resto de props para pasarlas al Base
const restProps = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { columns: _, ...rest } = props.props ?? {}
  return rest
})

/** Functions */

// 🔥 Actualizado: index ahora es 'number' para aceptar 0-7
function handleUpdateColumns(columnIndex: number, { block, blockId, childrenIds }: EditorChildrenChange) {
  // Copia defensiva del array de columnas
  const nColumns = [...columnsValue.value]

  // Actualizamos la columna específica
  nColumns[columnIndex] = { childrenIds }

  inspectorDrawer.setDocument({
    [blockId]: block,
    [currentBlockId]: {
      type: 'ColumnsContainer',
      data: ColumnsContainerPropsSchema.parse({
        style: props.style,
        props: {
          ...restProps.value,
          columns: nColumns,
        }
      })
    }
  })
}
</script>