// src/documents/blocks/Heading/HeadingPropsSchema.ts
import { z } from 'zod';
// Importamos el original solo para usar su base
import { HeadingPropsSchema as BaseHeadingPropsSchema } from '@flyhub/email-block-heading';
import type { HeadingProps as BaseHeadingProps } from '@flyhub/email-block-heading';

// 1. Extraemos las formas base
const BasePropsShape = BaseHeadingPropsSchema.shape.props.unwrap().unwrap().shape;
const BaseStyleObject = BaseHeadingPropsSchema.shape.style.unwrap().unwrap();

// 2. Definimos Schemas Flexibles (Los mismos helpers que ya conoces)
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
export const HeadingPropsSchema = z.object({
  style: BaseStyleObject.extend({
      // Padding flexible
      padding: PADDING_SCHEMA,
      
      // Font Size flexible
      fontSize: FONT_SIZE_SCHEMA,
      
      // Fuentes personalizadas (string abierto, no Enum)
      fontFamily: z.string().optional().nullable(),
      
      // Colores flexibles (cualquier string)
      backgroundColor: z.string().optional().nullable(),
      color: z.string().optional().nullable(),

      // Alineación
      textAlign: z.string().optional().nullable(),
      
      // Extras CSS
      lineHeight: z.union([z.number(), z.string()]).optional().nullable(),
      letterSpacing: z.union([z.number(), z.string()]).optional().nullable(),
  }).passthrough().optional().nullable(),

  props: z.object({
      // Heredamos text y level
      ...BasePropsShape,

      // 🔥 AGREGAMOS LO QUE FALTABA
      formats: z.array(z.any()).optional().nullable(), // Para negritas/itálicas
      markdown: z.boolean().optional().nullable(),
      variables: z.record(z.string(), z.any()).optional().nullable(),
    })
    .passthrough()
    .optional()
    .nullable(),
});

// 4. Tipos y Defaults
export type HeadingProps = z.infer<typeof HeadingPropsSchema>;

export const HeadingPropsDefaults = {
    text: 'Heading',
    level: 'h2'
} as const;

export default HeadingPropsSchema;