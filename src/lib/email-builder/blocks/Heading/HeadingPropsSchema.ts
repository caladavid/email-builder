import { z } from 'zod';
import { 
  COLOR_SCHEMA, 
  FONT_FAMILY_SCHEMA, 
  PADDING_SCHEMA, 
  FONT_FAMILY_NAMES 
} from '@flyhub/email-core';

// Definimos el esquema para los formatos de texto (negrita/cursiva parcial)
const TextFormatSchema = z.object({
  start: z.number(),
  end: z.number(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
});

export const HeadingPropsSchema = z.object({
  props: z
    .object({
      text: z.string().optional().nullable(),
      // 1. Ampliamos los niveles permitidos
      level: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).optional().nullable(),
      // 2. Agregamos soporte para guardar el formato enriquecido del editor
      formats: z.array(TextFormatSchema).optional().nullable(),
      markdown: z.boolean().optional().nullable(),
    })
    .optional()
    .nullable(),
  style: z
    .object({
      color: COLOR_SCHEMA,
      backgroundColor: COLOR_SCHEMA,
      fontFamily: FONT_FAMILY_SCHEMA,
      fontWeight: z.enum(['bold', 'normal']).optional().nullable(),
      textAlign: z.enum(['left', 'center', 'right', 'justify']).optional().nullable(),
      padding: PADDING_SCHEMA,
    })
    .optional()
    .nullable(),
});

// Definición de Tipos TypeScript actualizada
export type HeadingProps = {
  props?: {
    text?: string | null;
    level?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | null;
    formats?: { start: number; end: number; bold?: boolean; italic?: boolean }[] | null;
    markdown?: boolean | null;
  } | null;
  style?: {
    color?: string | null;
    backgroundColor?: string | null;
    fontFamily?: typeof FONT_FAMILY_NAMES[number] | null;
    fontWeight?: 'bold' | 'normal' | null;
    textAlign?: 'left' | 'center' | 'right' | 'justify' | null;
    padding?: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    } | null;
  } | null;
}

export const HeadingPropsDefaults = {
  level: 'h2',
  text: 'Heading',
} as const;