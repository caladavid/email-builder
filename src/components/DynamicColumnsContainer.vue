<template>
  <div :style="wStyle">
    <table
      align="center"
      width="100%"
      border="0"
      :style="tableStyle"
    >
      <tbody :style="{ width: '100%' }">
        <tr :style="{ width: '100%' }">
          <td 
            v-for="index in columnsCount" 
            :key="index"
            :width="getColumnWidth(index - 1)"
            :style="getCellStyle(index - 1)"
            valign="top"
          >
            <slot :name="`column-${index - 1}`" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getPadding } from '@flyhub/email-core';

// 1. IMPORT FIX: Import 'ColumnsContainerPropsDefaults' instead of 'BasePropsShape'
//    This object contains the runtime default values like { columnsCount: 2, ... }
import { ColumnsContainerPropsDefaults } from '../documents/blocks/ColumnsContainer/ColumnsContainerPropsSchema';
import type { ColumnsContainerProps } from '../documents/blocks/ColumnsContainer/ColumnsContainerPropsSchema'; 
import { getCleanBlockStyle } from '../utils/blockStyleUtils';

const props = defineProps<ColumnsContainerProps>();

// --- Main Container Styles ---
const wStyle = computed(() => {

  return getCleanBlockStyle(props.style, {
    display: 'block',
    width: '100%',
    // Aseguramos que el contenedor se comporte bien
    tableLayout: 'fixed', 
    backgroundColor: null // Default si no hay color
  });
});

const tableStyle = computed(() => {
  // 1. FILTRO DE SEGURIDAD
  // Extraemos las propiedades peligrosas que NO queremos que el usuario sobrescriba accidentalmente
  // y nos quedamos con el resto (bordes, colores, etc.) en 'safeStyles'.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { 
    display, 
    width, 
    height, 
    borderCollapse, 
    borderSpacing, 
    tableLayout,
    padding, // Lo manejamos manual abajo
    margin,  // Lo manejamos manual abajo
    ...safeStyles 
  } = props.style || {};

  return {
    // 2. INYECTAMOS LOS ESTILOS SEGUROS (Bordes, Backgrounds, Shadows)
    ...safeStyles,

    // 3. FORZAMOS LA ESTRUCTURA (Esto sobrescribe cualquier cosa anterior)
    // Aquí van tus "Magic Fixes" que arreglaron el problema original.
    tableLayout: "fixed",
    width: '100%',
    height: '100%',
    
    // Fixes Críticos de Espacios
    borderCollapse: 'collapse', 
    borderSpacing: '0px',
    msoTableLspace: '0pt', 
    msoTableRspace: '0pt',
    
    // 4. TU LÓGICA PERSONALIZADA
    // Mantenemos tu lógica de padding/margin/border
    padding: getPadding(props.style?.padding) || 0,
    margin: getPadding(props.style?.margin) || 0,
    border: props.style?.border || '0', 
  };
});

// --- Computed Properties for Column Logic ---

// 2. LOGIC FIX: Use 'ColumnsContainerPropsDefaults' for fallback values
const columnsCount = computed(() => 
  props.props?.columnsCount ?? ColumnsContainerPropsDefaults.columnsCount
);

const gap = computed(() => 
  props.props?.columnsGap ?? ColumnsContainerPropsDefaults.columnsGap
);

const contentAlignment = computed(() => 
  props.props?.contentAlignment ?? ColumnsContainerPropsDefaults.contentAlignment
);

// --- Helper Functions for Cells (<td>) ---

/**
 * Calculates percentage or fixed width for a column.
 * Uses fixed widths if defined, otherwise divides 100% by column count.
 */
function getColumnWidth(index: number) {
  const fixedWidths = props.props?.fixedWidths;
  
  if (fixedWidths && fixedWidths[index]) {
    return `${fixedWidths[index]}%`;
  }

  // Safety check for division by zero, though columnsCount defaults to 2
  const count = columnsCount.value || 1;
  return `${100 / count}%`;
}

/**
 * Calculates cell styles (alignment and gap).
 * Simulates 'gap' using padding on cells.
 */
function getCellStyle(index: number) {
  // 1. RECUPERAR DATOS
  const gapValue = props.props?.columnsGap || 0;
  const totalColumns = columnsCount.value;

  // 2. LÓGICA DE ALINEACIÓN (Lo nuevo)
  // Vertical
  const vAlign = props.props?.contentAlignment || 'top';
  
  // Horizontal (Prioridad: Sidebar > Estilo heredado > Default)
  const hAlign = props.props?.horizontalAlignment || props.style?.textAlign || 'left';

  const styles: any = {
    verticalAlign: vAlign,
    textAlign: hAlign,
    height: '100%', // Asegura que la celda llene la altura para que el vAlign funcione
  };

  // 3. LÓGICA DE GAP (Restaurada)
  // Añadimos padding-right a todas las columnas MENOS la última.
  // Esto simula el espacio vacío entre columnas de forma compatible con emails.
  if (gapValue > 0 && index < totalColumns - 1) {
    styles.paddingRight = `${gapValue}px`;
  }

  return styles;
}
</script>