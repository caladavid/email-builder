import { z } from 'zod';

// 1. Esquema Zod (Para validación en tiempo de ejecución/guardado)
export const TableSectionPropsSchema = z.object({
  style: z.record(z.any()).nullable().optional(),
  props: z.object({
    childrenIds: z.array(z.string()).optional().default([]),
    tagName: z.enum(['thead', 'tbody', 'tfoot']).optional().nullable(),
    id: z.string().optional().nullable(),
    className: z.string().optional().nullable(),
  }).optional().nullable()
});

// 2. Tipo TypeScript Manual (Para que Vue pueda leerlo sin errores)
export type TableSectionProps = {
  
  style?: Record<string, any> | null;
  
  props?: {
    childrenIds?: string[] | null;
    tagName?: 'thead' | 'tbody' | 'tfoot' | null;
    id?: string | null;
    className?: string | null;
  } | null;
};