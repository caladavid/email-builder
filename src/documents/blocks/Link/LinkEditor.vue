<template>
    <a
        :href="linkHref"
        :style="linkStyle"
        target="_blank"
    >
        {{ text }}
    </a>
</template>

<script setup lang="ts">
import { isSafeUrl } from '../../../utils/htmlSecurity';
import { computed } from 'vue';
import type { LinkProps } from './LinkPropsSchema';

const props = defineProps<LinkProps>();

const text = computed(() => props.props?.text ?? 'Link text');
const linkHref = computed(() => {
  const u = props.props?.url ?? "#";
  return isSafeUrl(u) ? u : "#";
});
const linkStyle = computed(() => ({
    color: props.style?.color ?? '#0079CC',  
    textDecoration: props.style?.textDecoration ?? 'underline',  
    fontFamily: props.style?.fontFamily ?? undefined,  
    fontSize: props.style?.fontSize ? `${props.style.fontSize}px` : undefined,  
    fontWeight: props.style?.fontWeight ?? 'normal',  
}));
</script>