// src/documents/blocks/ColumnsContainer/ColumnsContainerPropsSchema.ts
import { z } from 'zod';
import { ColumnsContainerPropsSchema as BaseColumnsContainerPropsSchema } from '@flyhub/email-block-columns-container';
import type { ColumnsContainerProps as BaseColumnsContainerProps } from '@flyhub/email-block-columns-container';

// 1. Extract base shape dynamically
const BasePropsShape = BaseColumnsContainerPropsSchema.shape.props.unwrap().unwrap().shape;
const BaseStyleObject = BaseColumnsContainerPropsSchema.shape.style.unwrap().unwrap();

// 2. 🔥 DEFINIMOS EL SCHEMA DE PADDING ROBUSTO
// Esto permite tanto "10px" (string) como { top: 10... } (objeto del sidebar)
const PADDING_SCHEMA = z.union([
  z.string(),
  z.object({
    top: z.union([z.number(), z.string()]).optional(),
    right: z.union([z.number(), z.string()]).optional(),
    bottom: z.union([z.number(), z.string()]).optional(),
    left: z.union([z.number(), z.string()]).optional(),
  })
]).optional().nullable();

// 3. Define the Zod Schema with overrides
export const ColumnsContainerPropsSchema = z.object({
  // 🔥 AQUÍ ESTÁ EL ARREGLO:
  // Usamos .extend() para decirle a Zod: "Usa el estilo base, PERO cambia la regla de padding"
  style: BaseStyleObject.extend({
      padding: PADDING_SCHEMA,
      // Aseguramos que color también sea flexible por si acaso
      backgroundColor: z.string().optional().nullable(),
  }).passthrough().optional().nullable(),

  props: z
    .object({
      ...BasePropsShape,

      horizontalAlignment: z.enum(['left', 'center', 'right']).optional().nullable(),
      // Allow 2 to 8 columns
      columnsCount: z.union([
        z.literal(2), z.literal(3), z.literal(4), z.literal(5),
        z.literal(6), z.literal(7), z.literal(8)
      ]).optional().nullable(),
      
      fixedWidths: z.array(z.string()).optional().nullable(),
      // Define columns array structure
      columns: z.array(z.object({   
      childrenIds: z.array(z.string()),  
      width: z.string().optional(),  
      style: z.object({  
        flexBasis: z.string().optional(),  
        flexGrow: z.number().optional(),  
        flexShrink: z.number().optional(),  
        minWidth: z.string().optional(),  
        maxWidth: z.string().optional()  
      }).optional()  
    }))  
      .min(2)  
      .max(8),
    })
    .optional()
    .nullable(),
});

// 4. Define the TypeScript Type
type BaseInnerProps = Extract<BaseColumnsContainerProps['props'], object>;

// Permitimos cualquier propiedad extra en style para que TS no se queje de los "zombis" antes de limpiarlos
type StyleWithPassthrough = NonNullable<BaseColumnsContainerProps['style']> & Record<string, any>;

export type ColumnsContainerProps = Omit<BaseColumnsContainerProps, 'props'> & {
  style?: StyleWithPassthrough | null;
  props?: (Omit<BaseInnerProps, 'columnsCount'> & {
    columnsCount?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | null;
    horizontalAlignment?: 'left' | 'center' | 'right' | null;
    columns: Array<{   
    childrenIds: string[];  
    width?: string;  
    style?: {  
      flexBasis?: string;  
      flexGrow?: number;  
      flexShrink?: number;  
      minWidth?: string;  
      maxWidth?: string;  
    };  
  }>;
    fixedWidths?: string[] | null;
  }) | null;
}

// 5. EXPORT THE DEFAULTS
export const ColumnsContainerPropsDefaults = {
  columnsCount: 2,
  columnsGap: 0,
  contentAlignment: 'middle',
  horizontalAlignment: 'left',
} as const;

export default ColumnsContainerPropsSchema;