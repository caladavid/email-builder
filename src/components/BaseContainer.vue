<template>
  <div :style="wStyle">
    <slot />
  </div>
</template>

<script lang="ts">
import { COLOR_SCHEMA, PADDING_SCHEMA, getPadding } from '@flyhub/email-core';
import { z } from 'zod';
import { computed } from 'vue';

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
const props = defineProps<ContainerProps>()

  /* console.log("BaseContainer", props.style); */
const wStyle = computed(() => ({
  ...props.style,
  display: 'block',
  backgroundColor: props.style?.backgroundColor ?? undefined,
  border: getBorder(props.style),
  borderRadius: props.style?.borderRadius ? props.style.borderRadius + 'px' : undefined,
  padding: getPadding(props.style?.padding),
  width: props.style?.width || "100%",
  maxWidth: props.style?.maxWidth ?? undefined,
  margin: getMargin(props.style?.margin), 
  textAlign: (props.style as any)?.textAlign || 'inherit'
}))

function getBorder(style: ContainerProps['style']) {
  if (!style || !style.borderColor) {
    return undefined;
  }
  return `1px solid ${style.borderColor}`;
}

// Agrega esta función en tu <script setup> o en tus helpers
function getMargin(margin: any) {
  if (!margin) return undefined;

  // Helper interno para formatear cada valor
  const fmt = (val: any) => {
    if (val === undefined || val === null) return '0px';
    if (val === 'auto') return 'auto'; // Si es auto, lo devuelve limpio
    if (typeof val === 'number') return `${val}px`; // Si es número, agrega px
    return val; // Si es string "10%", lo devuelve tal cual
  };

  return `${fmt(margin.top)} ${fmt(margin.right)} ${fmt(margin.bottom)} ${fmt(margin.left)}`;
}

</script>
