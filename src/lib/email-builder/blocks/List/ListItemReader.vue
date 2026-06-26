<template>
  <li :style="itemStyles" v-html="sanitizedText" />
</template>

<script lang="ts">
import { z } from 'zod';

export const ListItemPropsSchema = z.object({
  style: z.any().optional().nullable(),
  props: z.object({
    text: z.string().optional().nullable(),
    formats: z.any().optional().nullable(),
    ordered: z.boolean().optional().nullable(),
  }).optional().nullable(),
});

export type ListItemProps = {
  style?: any;
  props?: {
    text?: string | null;
    formats?: any;
    ordered?: boolean | null;
  } | null;
};
</script>

<script setup lang="ts">
import { computed } from 'vue';
import DOMPurify from 'dompurify';

const props = defineProps<ListItemProps>();

const itemStyles = computed(() => {
  const s = props.style;
  if (!s) return {};
  return {
    color: s.color ?? undefined,
    fontSize: s.fontSize ? `${s.fontSize}px` : undefined,
    fontFamily: s.fontFamily ?? undefined,
    lineHeight: s.lineHeight ?? '1.5',
  };
});

const sanitizedText = computed(() => {
  const raw = props.props?.text ?? '';
  return DOMPurify.sanitize(raw);
});
</script>
