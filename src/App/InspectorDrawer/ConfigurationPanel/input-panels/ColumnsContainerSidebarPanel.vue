<template>  
  <BaseSidebarPanel title="Bloque de columnas">  
    <RadioGroupInput  
      label="Numeros de columnas"  
      :model-value="String(props.data.props?.columnsCount ?? 2)"  
      :items="[    
        { label: '2', value: '2' },     
        { label: '3', value: '3' },    
        { label: '4', value: '4' },    
        { label: '5', value: '5' },    
        { label: '6', value: '6' }    
      ]"  
      @update:model-value="handleUpdateData({ ...props.data, props: { ...props.data.props, columnsCount: parseInt($event) } })"  
    />  
    <ColumnWidthsInput  
      :columns-count="props.data.props?.columnsCount ?? 3"  
      :model-value="props.data.props?.columns?.map(col => col.width || 'auto')"  
      @update:model-value="handleUpdateColumnsWidths"  
    />  
    <SliderInput  
      label="Espacio entre columnas (gap)"  
      icon-label="material-symbols:space-bar"  
      units="px"  
      :step="4"  
      :min="0"  
      :max="80"  
      :default-value="props.data.props?.columnsGap ?? 0"  
      @change="handleUpdateData({ ...props.data, props: { ...props.data.props, columnsGap: $event } })"  
    />  
    <RadioGroupInput  
      label="Alineación"  
      :model-value="props.data.props?.contentAlignment ?? 'middle'"  
      :items="[  
        { icon: 'material-symbols:vertical-align-top', value: 'top' },  
        { icon: 'material-symbols:vertical-align-center', value: 'middle' },  
        { icon: 'material-symbols:vertical-align-bottom', value: 'bottom' }  
      ]"  
      @update:model-value="handleUpdateData({ ...props.data, props: { ...props.data.props, contentAlignment: $event } })"  
    />  
  
    <!-- <RadioGroupInput    
      label="Alineación horizontal"    
      :model-value="props.data.props?.horizontalAlignment ?? 'left'"    
      :items="[    
        { icon: 'material-symbols:align-horizontal-left', value: 'left' },    
        { icon: 'material-symbols:align-horizontal-center', value: 'center' },    
        { icon: 'material-symbols:align-horizontal-right', value: 'right' }    
      ]"    
      @update:model-value="handleUpdateData({ ...props.data, props: { ...props.data.props, horizontalAlignment: $event } })"    
    />  --> 
  
    <MultiStylePropertyPanel  
      :names="['backgroundColor', 'padding']"  
      :model-value="props.data.style"  
      @update:model-value="handleUpdateData({ ...props.data, style: $event })"  
    />  
  </BaseSidebarPanel>  
</template>  
  
<script setup lang="ts">  
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';  
import RadioGroupInput from './helpers/inputs/RadioGroupInput.vue';  
import ColumnWidthsInput from './helpers/inputs/ColumnWidthsInput.vue';  
import type { ColumnsContainerProps } from '../../../../documents/blocks/ColumnsContainer/ColumnsContainerPropsSchema'  
import ColumnsContainerPropsSchema from '../../../../documents/blocks/ColumnsContainer/ColumnsContainerPropsSchema'  
import SliderInput from './helpers/inputs/SliderInput.vue';  
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';  
import { ref } from 'vue';  
  
type ColumnsContainerSidebarPanelProps = {  
  data: ColumnsContainerProps;  
}  
  
const props = defineProps<ColumnsContainerSidebarPanelProps>()  
  
const emit = defineEmits<{  
  (e: 'update:data', args: ColumnsContainerProps): void  
}>()  
  
/** Refs */  
  
const errors = ref<Zod.ZodError | null>(null)  
  
/** Functions */  
  
function handleUpdateColumnsWidths(widths: string[]) {
  
  if (!props.data.props) return;

  // Obtenemos las columnas actuales o un array vacío
  const currentColumns = props.data.props.columns || [];

  // Creamos nuevas columnas mapeando los anchos.
  // IMPORTANTE: Si aumentaste el número de columnas (ej de 2 a 3),
  // widths tendrá 3 elementos pero currentColumns podría tener 2.
  // Necesitamos iterar sobre 'widths' o sobre el número mayor para no perder datos.
  
  const updatedColumns = widths.map((width, index) => {
    const existingColumn = currentColumns[index] || {}; // Fallback si la columna no existe aún
    
    return {
       childrenIds: [], // Defaults necesarios si es nueva columna
       ...existingColumn,
       width: width || 'auto',
       style: {
         ...(existingColumn.style || {}),
         flexBasis: width || 'auto'
       }
    };
  });

  const updatedData = {
    ...props.data,
    props: {
      ...props.data.props,
      columns: updatedColumns,
      fixedWidths: widths
    }
  };
  
  handleUpdateData(updatedData);
}
  
function handleUpdateData(data: unknown) {  
  const res = ColumnsContainerPropsSchema.safeParse(data);  
  
  if (res.success) {  
    // Verificar que props exista  
    if (res.data.props) {  
      // Si hay fixedWidths, asegurar que las columnas tengan los mismos anchos    
      if (res.data.props.fixedWidths) {    
            
        const updatedColumns = res.data.props.columns.map((column, index) => ({    
          ...column,    
          width: res.data.props!.fixedWidths![index] || column.width,    
          style: {    
            ...column.style,    
            flexBasis: res.data.props!.fixedWidths![index] || column.style?.flexBasis    
          }    
        }));    
            
        res.data.props.columns = updatedColumns;    
      }  
    }  
      
    emit('update:data', res.data);    
    errors.value = null;    
  } else {    
    errors.value = res.error;    
  }    
}  
</script>