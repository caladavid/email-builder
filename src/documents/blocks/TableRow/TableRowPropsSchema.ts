import { z } from 'zod';  
  
export const TableRowPropsSchema = z.object({  
  style: z.object({  
    backgroundColor: z.string().optional(),  
    height: z.string().optional(),  
    width: z.string().optional(),
  }).passthrough().optional().nullable(),  
  props: z.object({  
    childrenIds: z.array(z.string()).optional().default([])  
  }).passthrough().optional().nullable()  
});  
  
export type TableRowProps = {  
  style?: {  
    backgroundColor?: string;  
    height?: string;  
    width?: string; 
  } | null;  
  props?: {  
    childrenIds?: string[] | null;  
  } | null;  
};