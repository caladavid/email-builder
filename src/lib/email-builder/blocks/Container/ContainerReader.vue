<template>
  <div :style="containerStyles">
    <ReaderBlock v-for="childId in childrenIds" :key="childId" :id="childId" :document="document" />
  </div>
</template>

<script setup lang="ts">
import BaseContainer from '@flyhub/email-block-container';
import ReaderBlock from '../../Reader/ReaderBlock.vue';
import type { ContainerProps } from './ContainerPropsSchema';
import { computed, type CSSProperties } from 'vue';

const props = defineProps<ContainerProps>()

  /* const childrenIds = props.props?.childrenIds ?? [] */
  const childrenIds = computed(() => props.props?.childrenIds ?? []);
  
  function getPadding(padding: any) {
    if (!padding) return undefined;
    // Convierte el objeto {top:10...} en "10px 0px..."
    return `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`;
  }
  
  function getMargin(margin: any) {
    if (!margin) return undefined;
    
    const fmt = (val: number | string | undefined) => {
      if (val === undefined || val === null) return '0px';
      if (val === 'auto') return 'auto';
      if (typeof val === 'number') return `${val}px`;
      return val;
    };
    
    return `${fmt(margin.top)} ${fmt(margin.right)} ${fmt(margin.bottom)} ${fmt(margin.left)}`;
  }
  
  function getBorder(style: any) {
    if (!style || !style.borderColor) return undefined;
    return `1px solid ${style.borderColor}`;
  }
  
  // --- 2. Estilos Computados ---
  
const containerStyles = computed<CSSProperties>(() => {
  const raw = props.style || {};
  
  const styles: CSSProperties = {
    // Propiedades directas
    backgroundColor: raw.backgroundColor ?? undefined,
    width: raw.width ?? undefined,
    maxWidth: raw.maxWidth ?? undefined,
    height: raw.height ?? undefined,
    display: raw.display ?? undefined,

    // Propiedades transformadas
    border: raw.borderColor ? `1px solid ${raw.borderColor}` : undefined,
    borderRadius: getBorder(raw.borderRadius),
    padding: getPadding(raw.padding),
    margin: getMargin(raw.margin),
    
    boxSizing: 'border-box'
  };

  return styles;
});


</script>
