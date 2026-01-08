import { z } from 'zod';

import { ContainerPropsSchema as BaseContainerPropsSchema} from '../../../lib/email-builder/blocks/Container';
import type { ContainerProps as BaseContainerProps } from '@flyhub/email-block-container';

const ContainerPropsSchema = z.object({
  style: BaseContainerPropsSchema.shape.style,
  props: z
    .object({
      childrenIds: z.array(z.string()).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export default ContainerPropsSchema;

export type ContainerProps = BaseContainerProps & {
  props?: {
    childrenIds?: string[] | null,
  } | null;
}

