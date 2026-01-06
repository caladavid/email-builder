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
    backgroundColor: COLOR_SCHEMA,  
    borderColor: COLOR_SCHEMA,  
    borderRadius: z.number().optional().nullable(),  
    width: z.string().optional().nullable(),  
    maxWidth: z.string().optional().nullable(), 
    height: z.string().optional().nullable(), 
    display: z.string().optional().nullable(),
    padding: PADDING_SCHEMA,  
    margin: MARGIN_SCHEMA,

  }).optional().nullable(),  
  props: z.object({  
    childrenIds: z.array(z.string()).optional().nullable()  
  }).optional().nullable()  
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
export type ContainerProps = BaseContainerProps & {
  // FIXME: type
  document: Record<string, any>; // required to render the ContainerColumn's children
  props?: {
    childrenIds?: string[] | null;
  } | null;
}
