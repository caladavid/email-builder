<template>
  <component 
    :is="headingTag" 
    class="heading-block"
    :style="computedStyles"
    v-html="textContent"
  />
</template>

<script lang="ts">
import { z } from 'zod';
import { getFontFamily, getPadding } from '@flyhub/email-core'; // O donde tengas tus helpers

// Reutilizamos el Schema del Padding si no lo importas
const PaddingSchema = z.object({
  top: z.number().default(0),
  bottom: z.number().default(0),
  right: z.number().default(0),
  left: z.number().default(0),
});

export const HeadingPropsSchema = z.object({
  style: z.object({
    color: z.string().optional().nullable(),
    backgroundColor: z.string().optional().nullable(),
    fontFamily: z.string().optional().nullable(),
    fontWeight: z.enum(['bold', 'normal']).optional().nullable(),
    textAlign: z.enum(['left', 'center', 'right', 'justify']).optional().nullable(),
    padding: PaddingSchema.optional().nullable(),
  }).optional().nullable(),
  props: z.object({
    text: z.string().optional().nullable(),
    level: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).optional().nullable(),
  }).optional().nullable(),
});

export type HeadingProps = {
  style?: {
    color?: string | null;
    backgroundColor?: string | null;
    fontFamily?: string | null;
    fontWeight?: 'bold' | 'normal' | null;
    textAlign?: 'left' | 'center' | 'right' | 'justify' | null;
    padding?: {
      top: number;
      bottom: number;
      right: number;
      left: number;
    } | null;
  } | null;
  props?: {
    text?: string | null;
    level?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | null;
  } | null;
}

export const HeadingPropsDefaults = {
  level: 'h2',
  text: 'Heading',
  color: '#000000'
} as const;
</script>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<HeadingProps>();

// 1. Determinar el tag (h1, h2...)
const headingTag = computed(() => props.props?.level ?? HeadingPropsDefaults.level);

// 2. Obtener el texto (HTML seguro)
const textContent = computed(() => {
  return props.props?.text ?? HeadingPropsDefaults.text;
});

// 3. Estilos Computados
const computedStyles = computed(() => {
  const s = props.style;
  const level = headingTag.value;

  // Tamaños base por defecto si no se especifican (Estándar de Email)
  const defaultSizes: Record<string, string> = {
    h1: '32px',
    h2: '24px',
    h3: '20px',
    h4: '16px',
    h5: '14px',
    h6: '13px'
  };

  return {
    color: s?.color ?? 'inherit',
    backgroundColor: s?.backgroundColor ?? undefined,
    textAlign: s?.textAlign ?? undefined,
    fontWeight: s?.fontWeight ?? 'bold',
    fontFamily: getFontFamily(s?.fontFamily),
    fontSize: defaultSizes[level], // El tamaño depende del nivel h1-h6
    padding: getPadding(s?.padding),
    margin: '0', // Importante para evitar márgenes default del navegador en emails
    lineHeight: '1.2', // Buen estándar para títulos
    wordBreak: 'break-word' as const
  };
});
</script>

<style scoped>
.heading-block {
  width: 100%;
  box-sizing: border-box;
}
/* Estilos para el contenido HTML interno generado por el editor */
.heading-block :deep(b), 
.heading-block :deep(strong) {
  font-weight: bold;
}
.heading-block :deep(i), 
.heading-block :deep(em) {
  font-style: italic;
}
</style>