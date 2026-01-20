import { z } from 'zod';

// Esquema para el Padding (igual que en tus otros componentes)
const PaddingSchema = z.object({
  top: z.number(),
  bottom: z.number(),
  right: z.number(),
  left: z.number(),
});

export const SpacerPropsSchema = z.object({
  // 1. Agregamos 'style' para soportar background y padding
  style: z.object({
    backgroundColor: z.string().optional().nullable(), // Para el color de fondo
    padding: PaddingSchema.optional().nullable(),      // Para espaciado externo si fuera necesario
  }).optional().nullable(),

  // 2. Mantenemos 'props' para la altura
  props: z.object({
    height: z.number().gte(0).optional().nullable(), // .gte(0) evita alturas negativas
  }).optional().nullable(),
});

// Definición del Tipo TypeScript
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
};

// Valores por defecto para usar si vienen nulos
export const SpacerPropsDefaults = {
  height: 16,
  backgroundColor: 'transparent'
};