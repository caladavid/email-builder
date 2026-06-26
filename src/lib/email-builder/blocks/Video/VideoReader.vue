<template>
  <div data-block-type="video" :style="wrapperStyles">
    <video
      :src="props.props?.url || undefined"
      :poster="props.props?.poster || undefined"
      :controls="props.props?.controls ?? true"
      :autoplay="props.props?.autoplay ?? false"
      :width="props.props?.width || undefined"
      :height="props.props?.height || undefined"
      style="max-width: 100%; display: block;"
    />
  </div>
</template>

<script lang="ts">
import { z } from 'zod';

export const VideoPropsSchema = z.object({
  style: z.object({
    backgroundColor: z.string().optional().nullable(),
    padding: z.object({
      top: z.number(),
      bottom: z.number(),
      right: z.number(),
      left: z.number(),
    }).optional().nullable(),
  }).passthrough().optional().nullable(),
  props: z.object({
    url: z.string().optional().nullable(),
    poster: z.string().optional().nullable(),
    controls: z.boolean().optional().nullable(),
    autoplay: z.boolean().optional().nullable(),
    width: z.number().optional().nullable(),
    height: z.number().optional().nullable(),
  }).optional().nullable(),
});

export type VideoProps = {
  style?: {
    backgroundColor?: string | null;
    padding?: { top: number; bottom: number; right: number; left: number } | null;
    [key: string]: any;
  } | null;
  props?: {
    url?: string | null;
    poster?: string | null;
    controls?: boolean | null;
    autoplay?: boolean | null;
    width?: number | null;
    height?: number | null;
  } | null;
};
</script>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<VideoProps>();

const wrapperStyles = computed(() => {
  const s = props.style;
  if (!s) return {};
  const p = s.padding;
  return {
    backgroundColor: s.backgroundColor ?? undefined,
    padding: p ? `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px` : undefined,
  };
});
</script>
