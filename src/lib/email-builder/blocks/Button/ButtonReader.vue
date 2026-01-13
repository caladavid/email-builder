<template>
  <div :style="wrapperStyle">
    <a :href="url" :style="linkStyle" target="_blank">
      <span v-html="firstSpan" />
      <span> {{ text }}</span>
      <span v-html="lastSpan" />
    </a>
  </div>
</template>

<script lang="ts">
import type { FONT_FAMILY_NAMES } from '@flyhub/email-core';
import { FONT_FAMILY_SCHEMA, PADDING_SCHEMA, getFontFamily, getPadding } from '@flyhub/email-core';
import { z } from 'zod';
import { computed } from 'vue';
import type { CSSProperties } from 'vue';

// 🔥 FIX 1: Creamos un validador de color permisivo (acepta RGB, RGBA, Nombres, Hex)
const ANY_COLOR_SCHEMA = z.string().optional().nullable();

export type ButtonProps = {
  style?: {
    backgroundColor?: string | null,
    fontSize?: number | null,
    fontFamily?: typeof FONT_FAMILY_NAMES[number] | null,
    fontWeight?: 'bold' | 'normal' | null,
    textAlign?: 'left' | 'center' | 'right' | null,
    padding?: {
      left: number,
      right: number,
      top: number,
      bottom: number,
    } | null,
    // 🔥 FIX 2: Permitir propiedades extra (como border, borderColor, etc.)
    [key: string]: any,
  } | null,
  props?: {
    buttonBackgroundColor?: string | null,
    buttonStyle?: 'rectangle' | 'pill' | 'rounded' | null,
    buttonTextColor?: string | null,
    fullWidth?: boolean | null,
    size?: 'x-small' | 'small' | 'large' | 'medium' | null,
    text?: string | null,
    url?: string | null,
  } | null,
}

export const ButtonPropsDefaults = {
  text: '',
  url: '',
  fullWidth: false,
  size: 'medium',
  buttonStyle: 'rounded',
  buttonTextColor: '#FFFFFF',
  buttonBackgroundColor: '#999999',
} as const;

export const ButtonPropsSchema = z.object({
  style: z
  .object({
    // Usamos el schema permisivo en lugar de COLOR_SCHEMA estricto
    backgroundColor: ANY_COLOR_SCHEMA, 
    fontSize: z.number().min(0).optional().nullable(),
    fontFamily: FONT_FAMILY_SCHEMA,
    fontWeight: z.enum(['bold', 'normal']).optional().nullable(),
    textAlign: z.enum(['left', 'center', 'right']).optional().nullable(),
    padding: PADDING_SCHEMA,
    
    // 🔥 FIX 3: Definimos explícitamente las props de borde para asegurar que pasen
    border: z.string().optional().nullable(),
    borderWidth: z.string().optional().nullable(),
    borderStyle: z.string().optional().nullable(),
    borderColor: ANY_COLOR_SCHEMA,
  })
  .passthrough() // 🔥 FIX 4: .passthrough() es vital para no borrar estilos extra
  .optional()
  .nullable(),
  props: z
  .object({
    buttonBackgroundColor: ANY_COLOR_SCHEMA,
    buttonStyle: z.enum(['rectangle', 'pill', 'rounded']).optional().nullable(),
    buttonTextColor: ANY_COLOR_SCHEMA,
    fullWidth: z.boolean().optional().nullable(),
    size: z.enum(['x-small', 'small', 'large', 'medium']).optional().nullable(),
    text: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
  })
  .optional()
  .nullable(),
});
</script>

<script setup lang="ts">

const props = defineProps<ButtonProps>()

const text = computed(() => props.props?.text ?? ButtonPropsDefaults.text)
const url = computed(() => props.props?.url ?? ButtonPropsDefaults.url)
const fullWidth = computed(() => props.props?.fullWidth ?? ButtonPropsDefaults.fullWidth)

// 🔥 FIX 5: Prioridad de colores. Si no hay prop, usa el estilo CSS.
const buttonTextColor = computed(() => 
    props.props?.buttonTextColor ?? props.style?.color ?? ButtonPropsDefaults.buttonTextColor
)
const buttonBackgroundColor = computed(() => 
    props.props?.buttonBackgroundColor ?? props.style?.backgroundColor ?? ButtonPropsDefaults.buttonBackgroundColor
)

const padding = computed(() => getButtonSizePadding(props.props))
const textRaise = computed(() => (padding.value[1] * 2 * 3) / 4)

const firstSpan = computed(() =>  ``)
const lastSpan = computed(() =>  ``)

const wrapperStyle = computed(() => ({
  backgroundColor: props.style?.backgroundColor ?? undefined,
  textAlign: props.style?.textAlign ?? undefined,
  padding: getPadding(props.style?.padding),
}))

const linkStyle = computed<CSSProperties>(() => {
  // Helper para leer propiedades kebab-case o camelCase
  const s = props.style || {};
  const getStyle = (key: string) => s[key];

  return {
    color: buttonTextColor.value,
    fontSize: (s.fontSize ?? 16) + 'px',
    fontFamily: getFontFamily(s.fontFamily),
    fontWeight: s.fontWeight ?? 'bold',
    backgroundColor: buttonBackgroundColor.value,
    borderRadius: getRoundedCorners(props.props),
    display: fullWidth.value ? 'block' : 'inline-block',
    padding: `${padding.value[0]}px ${padding.value[1]}px`,
    textDecoration: 'none',

    // 🔥 FIX 6: Mapeo explícito de bordes
    // Buscamos 'border', 'borderWidth', etc.
    border: getStyle('border'),
    borderWidth: getStyle('borderWidth') || getStyle('border-width'),
    // Truco: Si hay ancho pero no estilo, ponemos 'solid' para que se vea
    borderStyle: getStyle('borderStyle') || getStyle('border-style') || (getStyle('borderWidth') ? 'solid' : undefined),
    borderColor: getStyle('borderColor') || getStyle('border-color'),
    
    // Aseguramos que el borde no rompa el layout
    boxSizing: 'border-box'
  };
})

function getRoundedCorners(props: ButtonProps['props']) {
  const buttonStyle = props?.buttonStyle ?? ButtonPropsDefaults.buttonStyle;
  switch (buttonStyle) {
    case 'rectangle': return undefined;
    case 'pill': return 64 + 'px';
    case 'rounded': default: return 4 + 'px';
  }
}

function getButtonSizePadding(props: ButtonProps['props']) {
  const size = props?.size ?? ButtonPropsDefaults.size;
  switch (size) {
    case 'x-small': return [4, 8] as const;
    case 'small': return [8, 12] as const;
    case 'large': return [16, 32] as const;
    case 'medium': default: return [12, 20] as const;
  }
}
</script>