<template>
  <div :style="sectionStyle">
    <img v-if="!linkHref" v-bind="imgAttrs">
    <a v-else :href="linkHref" :style="{ textDecoration: 'none' }" target="_blank">
      <img v-bind="imgAttrs">
    </a>
  </div>
</template>

<script lang="ts">
import { PADDING_SCHEMA, getPadding } from '@flyhub/email-core';
import { z } from 'zod';
import { computed } from 'vue';

// --- DEFINICIÓN DEL SCHEMA Y TIPOS ---

export const ImagePropsSchema = z.object({
  style: z.object({
    padding: PADDING_SCHEMA,
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    textAlign: z.enum(['center', 'left', 'right']).optional().nullable(),
    // Al usar passthrough(), aceptamos border, radius, etc. automáticamente
  })
  .passthrough() 
  .optional()
  .nullable(),
  
  props: z.object({
    width: z.union([z.string(), z.number()]).optional().nullable(),
    height: z.union([z.string(), z.number()]).optional().nullable(),
    url: z.string().optional().nullable(),
    alt: z.string().optional().nullable(),
    linkHref: z.string().optional().nullable(),
    contentAlignment: z.enum(['top', 'middle', 'bottom']).optional().nullable(),
  })
  .passthrough()
  .optional()
  .nullable(),
});

export type ImageProps = {
  style?: {
    padding?: { left: number, right: number, top: number, bottom: number } | null,
    backgroundColor?: string | null,
    textAlign?: 'center' | 'left' | 'right' | null,
    [key: string]: any, // Permite props extra en TS
  } | null,
  props?: {
    width?: number  | string| null,
    height?: number | string | null,
    url?: string | null,
    alt?: string | null,
    linkHref?: string | null,
    contentAlignment?: 'top' | 'middle' | 'bottom' | null,
  } | null,
  document?: Record<string, any>;
}
</script>

<script setup lang="ts">
const props = defineProps<ImageProps>()

// --- LÓGICA DE PROPS ---
const width = computed(() => props.props?.width ?? undefined)
const height = computed(() => props.props?.height ?? undefined)
const linkHref = computed(() => props.props?.linkHref ?? null)

// --- LÓGICA DE ESTILOS (Aquí estaba el problema antes) ---
const sectionStyle = computed(() => ({
    padding: getPadding(props.style?.padding),
    backgroundColor: props.style?.backgroundColor ?? undefined,
    textAlign: props.style?.textAlign ?? undefined,
    lineHeight: '0px',
    fontSize: '0px',
}))

const formatDimension = (val: string | number | undefined | null) => {
    if (val === null || val === undefined || val === '') return undefined;
    if (typeof val === 'number') return `${val}px`;
    // Si es un string numérico puro ("500"), agregamos px. Si ya tiene unidad ("50%"), lo dejamos.
    return !isNaN(Number(val)) ? `${val}px` : val;
}


// --- LÓGICA DE LA IMAGEN ---
const imgAttrs = computed(() => ({
  alt: props.props?.alt ?? '',
  src: props.props?.url ?? '',
  width: width.value,
  height: height.value,
  style: {
    width: formatDimension(width.value),
    height: formatDimension(height.value),
    outline: 'none',
    border: 'none',
    textDecoration: 'none',
    verticalAlign: props.props?.contentAlignment ?? 'middle',
    display: 'inline-block',
    maxWidth: '100%',
  }
}))
</script>