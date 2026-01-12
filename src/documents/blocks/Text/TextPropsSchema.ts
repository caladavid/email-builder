// src/documents/blocks/Text/TextPropsSchema.ts
import { z } from 'zod';
import { TextPropsSchema as BaseTextPropsSchema } from '@flyhub/email-block-text';
import type { TextProps as BaseTextProps } from '@flyhub/email-block-text';

// 1. Extraemos las formas base
const BasePropsShape = BaseTextPropsSchema.shape.props.unwrap().unwrap().shape;
const BaseStyleObject = BaseTextPropsSchema.shape.style.unwrap().unwrap();

// 2. Definimos Schemas Flexibles
const PADDING_SCHEMA = z.union([
  z.string(),
  z.object({
    top: z.union([z.number(), z.string()]).optional(),
    right: z.union([z.number(), z.string()]).optional(),
    bottom: z.union([z.number(), z.string()]).optional(),
    left: z.union([z.number(), z.string()]).optional(),
  })
]).optional().nullable();

const FONT_SIZE_SCHEMA = z.union([z.number(), z.string()]).optional().nullable();

// 3. 🔥 SOBRESCRIBIMOS EL SCHEMA
export const TextPropsSchema = z.object({
  style: BaseStyleObject.extend({
      // Fix Padding
      padding: PADDING_SCHEMA,
      
      // Fix Font Size
      fontSize: FONT_SIZE_SCHEMA,
      
      // Fix Fuentes (permitir custom fonts)
      fontFamily: z.string().optional().nullable(),
      
      // 🔥 FIX COLORES: Sobrescribimos el Regex estricto de la librería
      // Esto permite "transparent", "red", "rgba(...)" o ""
      backgroundColor: z.string().optional().nullable(),
      color: z.string().optional().nullable(),

      // Permitir propiedades extra CSS
      lineHeight: z.union([z.number(), z.string()]).optional().nullable(),
      letterSpacing: z.union([z.number(), z.string()]).optional().nullable(),
      textAlign: z.string().optional().nullable(), // Por si acaso
  }).passthrough().optional().nullable(),

  props: z.object({
      ...BasePropsShape,
      formats: z.array(z.any()).optional().nullable(),
      variables: z.record(z.string(), z.any()).optional().nullable(),
    })
    .passthrough()
    .optional()
    .nullable(),
});

// 4. Tipos y Defaults
export type TextProps = z.infer<typeof TextPropsSchema>;

export const TextPropsDefaults = {
    text: '',
    markdown: false
};

export default TextPropsSchema;