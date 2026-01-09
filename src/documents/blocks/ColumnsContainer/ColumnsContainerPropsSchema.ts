// src/documents/blocks/ColumnsContainer/ColumnsContainerPropsSchema.ts
import { z } from 'zod';
import { ColumnsContainerPropsSchema as BaseColumnsContainerPropsSchema } from '@flyhub/email-block-columns-container';
import type { ColumnsContainerProps as BaseColumnsContainerProps } from '@flyhub/email-block-columns-container';

// 1. Extract base shape dynamically to avoid import errors
const BasePropsShape = BaseColumnsContainerPropsSchema.shape.props.unwrap().unwrap().shape;
const BaseStyleObject = BaseColumnsContainerPropsSchema.shape.style.unwrap().unwrap();

// 2. Define the Zod Schema with overrides
export const ColumnsContainerPropsSchema = z.object({
  style: BaseStyleObject.passthrough().optional().nullable(),
  props: z
    .object({
      ...BasePropsShape,
      // Allow 2 to 8 columns
      columnsCount: z.union([
        z.literal(2), z.literal(3), z.literal(4), z.literal(5),
        z.literal(6), z.literal(7), z.literal(8)
      ]).optional().nullable(),
      
      // Define columns array structure
      columns: z.array(z.object({ childrenIds: z.array(z.string()) }))
        .min(2)
        .max(8),
    })
    .optional()
    .nullable(),
});

// 3. Define the TypeScript Type
type BaseInnerProps = Extract<BaseColumnsContainerProps['props'], object>;

type StyleWithPassthrough = NonNullable<BaseColumnsContainerProps['style']> & Record<string, any>;

export type ColumnsContainerProps = Omit<BaseColumnsContainerProps, 'props'> & {
  style?: StyleWithPassthrough | null;
  props?: (Omit<BaseInnerProps, 'columnsCount'> & {
    columnsCount?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | null;
    columns: Array<{ childrenIds: string[] }>;
  }) | null;
}

// 4. ✅ EXPORT THE DEFAULTS (This was missing)
export const ColumnsContainerPropsDefaults = {
  columnsCount: 2,
  columnsGap: 0,
  contentAlignment: 'middle',
} as const;

export default ColumnsContainerPropsSchema;