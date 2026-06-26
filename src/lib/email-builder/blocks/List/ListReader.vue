<template>
  <component :is="isOrdered ? 'ol' : 'ul'" :style="listStyles">
    <ReaderBlock v-for="childId in childrenIds" :key="childId" :id="childId" :document="document" />
  </component>
</template>

<script lang="ts">
import { z } from 'zod';

export const ListPropsSchema = z.object({
  style: z.any().optional().nullable(),
  props: z.object({
    childrenIds: z.array(z.string()).optional().nullable(),
    ordered: z.boolean().optional().nullable(),
  }).optional().nullable(),
});

export type ListProps = {
  style?: any;
  props?: {
    childrenIds?: string[] | null;
    ordered?: boolean | null;
  } | null;
  document?: Record<string, any>;
};
</script>

<script setup lang="ts">
import { computed } from 'vue';
import ReaderBlock from '../../Reader/ReaderBlock.vue';

const props = defineProps<ListProps>();

// Handle both data.props.childrenIds (correct) and data.childrenIds (legacy bug)
const childrenIds = computed(() => props.props?.childrenIds ?? (props as any).childrenIds ?? []);
const isOrdered = computed(() => props.props?.ordered ?? false);

const listStyles = computed(() => {
  const s = props.style;
  if (!s) return { paddingLeft: '24px', margin: '0' };
  const p = s.padding;
  return {
    backgroundColor: s.backgroundColor ?? undefined,
    padding: p ? `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px` : undefined,
    paddingLeft: p ? `${p.left}px` : '24px',
    color: s.color ?? undefined,
    fontSize: s.fontSize ? `${s.fontSize}px` : undefined,
    fontFamily: s.fontFamily ?? undefined,
    margin: '0',
  };
});
</script>
