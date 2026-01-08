import { z } from 'zod';  
  
export const TableRowPropsSchema = z.object({  
  style: z.object({  
    backgroundColor: z.string().optional(),  
    height: z.string().optional(),  
  }).passthrough().optional().nullable(),  
  props: z.object({  
    childrenIds: z.array(z.string()).optional().default([])  
  }).passthrough().optional().nullable()  
});  
  
export type TableRowProps = {  
  document: Record<string, any>;  
  style?: {  
    backgroundColor?: string;  
    height?: string;  
  } | null;  
  props?: {  
    childrenIds?: string[] | null;  
  } | null;  
};