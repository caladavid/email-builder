import { z } from 'zod';

import { ColumnsContainerPropsSchema as BaseColumnsContainerPropsSchema } from '@flyhub/email-block-columns-container';
import type { ColumnsContainerProps as BaseColumnsContainerProps } from '@flyhub/email-block-columns-container';

const BasePropsShape = BaseColumnsContainerPropsSchema.shape.props.unwrap().unwrap().shape;

const ColumnsContainerPropsSchema = z.object({
  style: BaseColumnsContainerPropsSchema.shape.style,
  props: z
    .object({
      ...BasePropsShape,
      columns: z.array(z.object({ childrenIds: z.array(z.string()) })).min(1),
    })
    .optional()
    .nullable(),
});

export type ColumnsContainerProps = Omit<BaseColumnsContainerProps, 'props'> & {
  props?: Extract<BaseColumnsContainerProps['props'], object> & {
    columns: Array<{ childrenIds: string[] }>;
  }
  | null;
}

export default ColumnsContainerPropsSchema;
