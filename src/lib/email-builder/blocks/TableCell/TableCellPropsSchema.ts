import { z } from 'zod';  
  
export const TableCellPropsSchema = z.object({  
  style: z.object({  
    border: z.string().optional(),  
    padding: z.string().optional(),  
    backgroundColor: z.string().optional(),  
    textAlign: z.enum(["left", "center", "right"]).optional(),  
    verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),  
  }).optional().nullable(),  
  props: z.object({  
    childrenIds: z.array(z.string()).optional().default([]),  
    colspan: z.number().optional().default(1),  
    rowspan: z.number().optional().default(1),  
    align: z.enum(["left", "center", "right", "justify", "char"]).optional(),  
    valign: z.enum(["top", "middle", "bottom", "baseline"]).optional()  
  }).optional().nullable()  
});  
  
export type TableCellProps = {  
  document: Record<string, any>;  
  style?: {  
    border?: string;  
    padding?: string;  
    backgroundColor?: string;  
    textAlign?: "left" | "center" | "right";  
    verticalAlign?: "top" | "middle" | "bottom";  
  } | null;  
  props?: {  
    childrenIds?: string[] | null;  
    colspan?: number;  
    rowspan?: number;  
    align?: "left" | "center" | "right" | "justify" | "char";  
    valign?: "top" | "middle" | "bottom" | "baseline";  
  } | null;  
};