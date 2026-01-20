<template>
  <div class="spacer" :style="computedStyles">
    &nbsp;
  </div>
</template>

<script lang="ts">
import { z } from 'zod';

// Esquema de Padding reutilizable (o definido inline)
const PaddingSchema = z.object({
  top: z.number().default(0),
  bottom: z.number().default(0),
  right: z.number().default(0),
  left: z.number().default(0),
});

export const SpacerPropsSchema = z.object({
  style: z.object({
    backgroundColor: z.string().optional().nullable(),
    padding: PaddingSchema.optional().nullable(),
  }).optional().nullable(),
  props: z.object({
    height: z.number().gte(0).optional().nullish(),
  }).optional().nullable(),
});

export type SpacerProps = {
  style?: {
    backgroundColor?: string | null;
    padding?: {
      top: number;
      bottom: number;
      right: number;
      left: number;
    } | null;
  } | null;
  props?: {
    height?: number | null;
  } | null;
}

export const SpacerPropsDefaults = {
  height: 16,
  backgroundColor: 'transparent'
};
</script>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<SpacerProps>();

const computedStyles = computed(() => {
  const heightVal = props.props?.height ?? SpacerPropsDefaults.height;
  const s = props.style;

  // Construcción del string de padding
  let paddingStr = undefined;
  if (s?.padding) {
    paddingStr = `${s.padding.top}px ${s.padding.right}px ${s.padding.bottom}px ${s.padding.left}px`;
  }

  return {
    // La altura define el bloque
    height: `${heightVal}px`,
    
    // El color de fondo
    backgroundColor: s?.backgroundColor ?? undefined,
    
    // Padding (si se desea espacio interno extra o para empujar bordes si los hubiera)
    padding: paddingStr,

    // --- PROPIEDADES NECESARIAS PARA EMAIL CLIENTS ---
    width: '100%',
    display: 'block',
    // Asegura que Outlook respete la altura exacta y no ponga la altura de la fuente por defecto
    lineHeight: `${heightVal}px`, 
    fontSize: '0px', 
    // Asegura que no colapse
    minHeight: `${heightVal}px` 
  };
});
</script>