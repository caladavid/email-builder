// src/documents/blocks/Button/ButtonPropsSchema.ts
import { z } from 'zod';
import { ButtonPropsSchema as BaseButtonPropsSchema } from '@flyhub/email-block-button';
import type { ButtonProps as BaseButtonProps } from '@flyhub/email-block-button';

// 1. Extraemos las formas base (Misma técnica que en Columns)
const BasePropsShape = BaseButtonPropsSchema.shape.props.unwrap().unwrap().shape;
const BaseStyleObject = BaseButtonPropsSchema.shape.style.unwrap().unwrap();

// 2. 🔥 DEFINIMOS EL PADDING FLEXIBLE
// Esto permite que el sidebar envíe objetos sin romper la validación
const PADDING_SCHEMA = z.union([
  z.string(),
  z.object({
    top: z.union([z.number(), z.string()]).optional(),
    right: z.union([z.number(), z.string()]).optional(),
    bottom: z.union([z.number(), z.string()]).optional(),
    left: z.union([z.number(), z.string()]).optional(),
  })
]).optional().nullable();

const BORDER_SCHEMA = z.union([
  z.string(), // "1px solid red"
  z.number(), // 0
  z.object({  // { width: 1, style: 'solid', ... }
    width: z.union([z.number(), z.string()]).optional(),
    style: z.string().optional(),
    color: z.string().optional(),
    radius: z.union([z.number(), z.string()]).optional() // A veces radius viene aquí
  })
]).optional().nullable();

// 3. Sobrescribimos el Schema
export const ButtonPropsSchema = z.object({
  // Extendemos el estilo para permitir padding objeto y otras props CSS
  style: BaseStyleObject.extend({
      padding: PADDING_SCHEMA,

      border: BORDER_SCHEMA,
      borderWidth: z.union([z.number(), z.string()]).optional().nullable(),
      borderColor: z.string().optional().nullable(),
      borderStyle: z.string().optional().nullable(),
      borderRadius: z.union([z.number(), z.string()]).optional().nullable(),
      // Aseguramos que backgroundColor acepte string (hex)
      backgroundColor: z.string().optional().nullable(),
      textAlign: z.string().optional().nullable(),
  }).passthrough().optional().nullable(),

  props: z
    .object({
      ...BasePropsShape,
      // Aquí puedes sobrescribir props específicas si fuera necesario
      // Por ahora dejamos las base
    })
    .optional()
    .nullable(),
});

// 4. Definimos el Tipo TypeScript compatible
type BaseInnerProps = Extract<BaseButtonProps['props'], object>;
type StyleWithPassthrough = NonNullable<BaseButtonProps['style']> & Record<string, any>;

export type ButtonProps = Omit<BaseButtonProps, 'props'> & {
  style?: StyleWithPassthrough | null;
  props?: BaseInnerProps | null;
}

// 5. Exportamos defaults (útil para el editor)
export const ButtonPropsDefaults = {
  text: 'Button',
  url: '',
  fullWidth: false,
  size: 'medium',
  buttonStyle: 'rounded',
  buttonTextColor: '#ffffff',
  buttonBackgroundColor: '#007bff'
} as const;

export default ButtonPropsSchema;