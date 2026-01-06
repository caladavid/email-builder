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
    backgroundColor: COLOR_SCHEMA,
    borderColor: COLOR_SCHEMA,
    borderRadius: z.number().optional().nullable(),
    padding: PADDING_SCHEMA,
    margin: MARGIN_VALUE_SCHEMA,
    width: z.string().optional().nullable(),
    maxWidth: z.string().optional().nullable(),
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
  backgroundColor: props.style?.backgroundColor ?? undefined,
  border: getBorder(props.style),
  borderRadius: props.style?.borderRadius ? props.style.borderRadius + 'px' : undefined,
  padding: getPadding(props.style?.padding),
  width: props.style?.width ?? undefined,
  maxWidth: props.style?.maxWidth ?? undefined,
  margin: getMargin(props.style?.margin), 
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
