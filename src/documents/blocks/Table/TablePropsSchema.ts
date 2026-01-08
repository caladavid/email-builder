import { z } from 'zod';  
  
export const TablePropsSchema = z.object({  
  style: z.object({  
    width: z.string().optional(),  
    borderCollapse: z.enum(["collapse", "separate"]).optional(),  
    backgroundColor: z.string().optional(),  
    marginLeft: z.string().optional(),
    marginRight: z.string().optional(),
    textAlign: z.string().optional(),
  }).passthrough().optional().nullable(),  
  props: z.object({  
    childrenIds: z.array(z.string()).optional().default([]),
    align: z.string().optional().nullable(),
    cellpadding: z.string().optional().nullable(),
    cellspacing: z.string().optional().nullable(),
    border: z.string().optional().nullable(),
  }).passthrough().optional().nullable()  
});  
  
export type TableProps = {  
  style?: {  
    width?: string;  
    borderCollapse?: "collapse" | "separate";  
    backgroundColor?: string;  
  } | null;  
  props?: {  
    childrenIds?: string[] | null;  
    colspan?: number;  
    rowspan?: number;  
  } | null;  
};