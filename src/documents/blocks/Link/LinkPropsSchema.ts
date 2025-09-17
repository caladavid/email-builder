import { z } from 'zod';  
import { PADDING_SCHEMA } from '@flyhub/email-core';  
  
export const LinkPropsSchema = z.object({  
  style: z.object({  
    color: z.string().optional().nullable(),  
    textDecoration: z.enum(['underline', 'none']).optional().nullable(),  
    fontFamily: z.string().optional().nullable(),  
    fontSize: z.number().optional().nullable(),  
    fontWeight: z.string().optional().nullable(),  
    padding: PADDING_SCHEMA,  
  }).optional().nullable(),  
  props: z.object({  
    text: z.string().optional().nullable(),  
    url: z.string().optional().nullable(),  
  }).optional().nullable(),  
});  
  
export type LinkProps = {  
  style?: {  
    color?: string | null;  
    textDecoration?: 'underline' | 'none' | null;  
    fontFamily?: string | null;  
    fontSize?: number | null;  
    fontWeight?: string | null;  
    padding?: {  
      left: number;  
      right: number;  
      top: number;  
      bottom: number;  
    } | null;  
  } | null;  
  props?: {  
    text?: string | null;  
    url?: string | null;  
  } | null;  
}