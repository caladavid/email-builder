import { z } from 'zod';  
  
export const TablePropsSchema = z.object({  
  style: z.object({  
    width: z.string().optional(),  
    borderCollapse: z.enum(["collapse", "separate"]).optional(),  
    backgroundColor: z.string().optional(),  
  }).optional().nullable(),  
  props: z.object({  
    childrenIds: z.array(z.string()).optional().default([])  
  }).optional().nullable()  
});  
  
export type TableProps = {  
  document: Record<string, any>;  
  style?: {  
    width?: string;  
    borderCollapse?: "collapse" | "separate";  
    backgroundColor?: string;  
  } | null;  
  props?: {  
    childrenIds?: string[] | null;  
  } | null;  
};