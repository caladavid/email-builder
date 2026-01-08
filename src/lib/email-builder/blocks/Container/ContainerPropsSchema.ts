import { z } from 'zod';

/* import { ContainerPropsSchema as BaseContainerPropsSchema } from '../../../@flyhub/email-builder/blocks/Container/ContainerPropsSchema'; */
import type { ContainerProps as BaseContainerProps } from '@flyhub/email-block-container';

const COLOR_SCHEMA = z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional();

const PADDING_SCHEMA = z.object({
  top: z.number(),
  bottom: z.number(),
  right: z.number(),
  left: z.number()
}).optional().nullable();

const MARGIN_VALUE_SCHEMA = z.union([z.number(), z.string()]); // Soporta 10 y "auto"

const MARGIN_SCHEMA = z.object({
  top: MARGIN_VALUE_SCHEMA.optional(),
  bottom: MARGIN_VALUE_SCHEMA.optional(),
  right: MARGIN_VALUE_SCHEMA.optional(),
  left: MARGIN_VALUE_SCHEMA.optional(),
}).optional().nullable();

const BaseContainerPropsSchema = z.object({  
  style: z.object({  
    // Propiedades básicas y Colores
    backgroundColor: COLOR_SCHEMA,
    backgroundImage: z.string().optional().nullable(),
    borderColor: COLOR_SCHEMA,
    color: COLOR_SCHEMA,
    
    // Dimensiones y Layout (Resuelve error TS y W:Auto)
    borderRadius: z.number().optional().nullable(),
    width: z.string().optional().nullable(),
    maxWidth: z.string().optional().nullable(),
    height: z.string().optional().nullable(),
    display: z.string().optional().nullable(),
    boxSizing: z.string().optional().nullable(),
    
    // Alineación (Crucial para corregir el "Start")
    textAlign: z.string().optional().nullable(),
    verticalAlign: z.string().optional().nullable(),
    flexDirection: z.string().optional().nullable(),
    justifyContent: z.string().optional().nullable(),
    lineHeight: z.string().optional().nullable(),

    // Espaciado (Objetos y Propiedades Planas)
    padding: PADDING_SCHEMA,
    margin: MARGIN_SCHEMA,
    paddingTop: z.string().optional().nullable(),
    paddingBottom: z.string().optional().nullable(),
    paddingLeft: z.string().optional().nullable(),
    paddingRight: z.string().optional().nullable(),
    marginTop: z.string().optional().nullable(),
    marginBottom: z.string().optional().nullable(),
    marginLeft: z.string().optional().nullable(),
    marginRight: z.string().optional().nullable(),

    // Soporte para estilos móviles del Parser
    mobileStyle: z.any().optional(),

  }).passthrough().optional().nullable(),  
  props: z.object({  
    childrenIds: z.array(z.string()).optional().nullable(),
    tagName: z.string().optional().nullable(),
    className: z.string().optional().nullable(),
    id: z.string().optional().nullable(),
    align: z.string().optional().nullable(),
  }).passthrough().optional().nullable()  
});  

export const ContainerPropsSchema = z.object({
  style: BaseContainerPropsSchema.optional().nullable(),
  props: z
    .object({
      childrenIds: z.array(z.string()).optional().nullable(),
    })
    .optional()
    .nullable(),
});

// export type ContainerProps = z.infer<typeof ContainerPropsSchema>;
export type ContainerProps = {
  style?: z.infer<typeof BaseContainerPropsSchema>['style'];
  props?: {
    childrenIds?: string[] | null;
    tagName?: string | null;
    className?: string | null;
    id?: string | null;
    align?: string | null;
    textAlign?: string | null; 
    display?: string | null;
    width?: string | null;
  } | null;
  document: Record<string, any>; // Obligatorio para el Reader
}
