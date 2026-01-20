<template>
  <div :style="wStyle">
    <slot />
  </div>
</template>

<script lang="ts">
import { COLOR_SCHEMA, PADDING_SCHEMA, getPadding } from '@flyhub/email-core';
import { z } from 'zod';
import { computed, nextTick, watch } from 'vue';
import { getCleanBlockStyle } from '../utils/blockStyleUtils';

const MARGIN_VALUE_SCHEMA = z.union([z.number(), z.string()]);

const MARGIN_SCHEMA = z.object({
  top: MARGIN_VALUE_SCHEMA.optional(),
  bottom: MARGIN_VALUE_SCHEMA.optional(),
  right: MARGIN_VALUE_SCHEMA.optional(),
  left: MARGIN_VALUE_SCHEMA.optional(),
}).optional().nullable();

export const ContainerPropsSchema = z.object({
  style: z
  .object({
    // Propiedades básicas
    backgroundColor: COLOR_SCHEMA,
    backgroundImage: z.string().optional().nullable(),
    borderColor: COLOR_SCHEMA,
    borderRadius: z.number().optional().nullable(),
    width: z.string().optional().nullable(),
    maxWidth: z.string().optional().nullable(),
    height: z.string().optional().nullable(),
    
    // Propiedades de Layout (Las que causaban error TS)
    display: z.string().optional().nullable(),
    boxSizing: z.string().optional().nullable(),
    textAlign: z.string().optional().nullable(),
    verticalAlign: z.string().optional().nullable(),
    
    // Espaciado corregido
    padding: PADDING_SCHEMA,
    margin: MARGIN_SCHEMA,
    
    // Soporte para propiedades individuales que inyecta el Parser
    paddingTop: z.string().optional().nullable(),
    paddingBottom: z.string().optional().nullable(),
    paddingLeft: z.string().optional().nullable(),
    paddingRight: z.string().optional().nullable(),
    marginTop: z.string().optional().nullable(),
    marginBottom: z.string().optional().nullable(),
    marginLeft: z.string().optional().nullable(),
    marginRight: z.string().optional().nullable(),
    
    // Otros
    color: COLOR_SCHEMA,
    lineHeight: z.string().optional().nullable(),
    mobileStyle: z.any().optional(), // Para evitar errores con el Proxy de móvil
  })
  .optional()
  .nullable(),
});

export type ContainerProps = {
  style?: {
    backgroundColor?: string | null,
    borderColor?: string | null,
    borderRadius?: number | null,
    width?: string | null,
    maxWidth?: string | null,
    textAlign?: "left" | "center" | "right" | "justify" | "inherit" | null,
    padding?: {
      left: number,
      right: number,
      top: number,
      bottom: number,
    } | null,
    margin?: {  
      left: number | string,  
      right: number | string,  
      top: number | string,  
      bottom: number | string,  
    } | null,  
  } | null,
}
</script>

<script setup lang="ts">
const props = defineProps<{
  style?: any // O tu tipo ContainerProps
}>();

  /* console.log("BaseContainer", props.style); */
const wStyle = computed(() => {
  // Llamamos al helper pasando los estilos crudos y los DEFAULTS específicos de Container
  return getCleanBlockStyle(props.style, {
    ...props.style,
    // Estos son los valores que se usarán si props.style no trae nada
    display: 'block',         // Equivale a: s.display || 'block'
    width: '100%',            // Equivale a: s.width || '100%'
    boxSizing: 'border-box',
    
    // Defaults de fondo
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    
    // Defaults de texto
    textAlign: 'inherit'
  });
});

</script>
