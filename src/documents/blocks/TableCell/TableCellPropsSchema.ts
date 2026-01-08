import { z } from 'zod';  
  
export const TableCellPropsSchema = z.object({  
  style: z.object({  
    border: z.string().optional(),  
    padding: z.string().optional(),  
    backgroundColor: z.string().optional(),  
    textAlign: z.enum(["left", "center", "right"]).optional(),  
    width: z.string().optional(),
    verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),  
  }).passthrough().optional().nullable(),  
  props: z.object({  
    childrenIds: z.array(z.string()).optional().default([]),  
    colspan: z.number().optional().default(1),  
    rowspan: z.number().optional().default(1),  
    align: z.enum(["left", "center", "right", "justify", "char"]).optional(),  
    valign: z.enum(["top", "middle", "bottom", "baseline"]).optional(),
    width: z.string().optional(), 
    tagName: z.string().optional(),
  }).passthrough().optional().nullable()  
});  
  
export type TableCellProps = {  
  style?: {  
    border?: string;  
    padding?: string;  
    backgroundColor?: string;  
    textAlign?: "left" | "center" | "right";  
    verticalAlign?: "top" | "middle" | "bottom"; 
    width?: string; 
  } | null;  
  props?: {  
    childrenIds?: string[] | null;  
    colspan?: number;  
    rowspan?: number;  
    align?: "left" | "center" | "right" | "justify" | "char";  
    valign?: "top" | "middle" | "bottom" | "baseline";  
    width?: string; 
  } | null;  
};