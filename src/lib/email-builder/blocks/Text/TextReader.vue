<template>
  <div 
    class="text-block-reader"
    :style="computedStyles"
    v-html="renderedContent"
  ></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getFontFamily, getPadding } from '@flyhub/email-core';

// 1. Definición de Tipos basada en tu Schema Zod
type TextProps = {
  style?: {
    color?: string | null;
    backgroundColor?: string | null;
    fontSize?: number | null;
    fontFamily?: string | null;
    fontWeight?: 'bold' | 'normal' | null;
    textAlign?: 'left' | 'center' | 'right' | null;
    padding?: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    } | null;
  } | null;
  props?: {
    markdown?: boolean | null;
    text?: string | null;
  } | null;
};

const props = defineProps<TextProps>();

const TextPropsDefaults = {
  text: ''
};

// 2. Estilos Computados
const computedStyles = computed(() => {
  const s = props.style;
  
  return {
    color: s?.color ?? undefined,
    backgroundColor: s?.backgroundColor ?? undefined,
    fontSize: s?.fontSize ? `${s.fontSize}px` : undefined,
    fontFamily: getFontFamily(s?.fontFamily), // Helper de tu librería core
    fontWeight: s?.fontWeight ?? undefined,
    textAlign: s?.textAlign ?? undefined,
    padding: getPadding(s?.padding),          // Helper de tu librería core
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap', // Preserva saltos de línea
    wordBreak: 'break-word' as const
  };
});

// 3. Lógica de Renderizado (Markdown vs HTML/Texto)
const renderedContent = computed(() => {
  const rawText = props.props?.text ?? TextPropsDefaults.text;

  // Si no es markdown, devolvemos el texto (o HTML si tu editor guarda HTML)
  if (!props.props?.markdown) {
    return rawText;
  }

  // Si es Markdown, aplicamos un parser simple
  return parseBasicMarkdown(rawText);
});

/**
 * Parser ligero de Markdown para no depender de librerías externas pesadas.
 * Soporta: Negrita (**), Cursiva (* o _), y Saltos de línea.
 */
function parseBasicMarkdown(text: string): string {
  if (!text) return '';

  let html = text
    // Escapar HTML existente para evitar inyecciones si es markdown puro
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
    // Negrita: **texto**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    
    // Cursiva: *texto* o _texto_
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    
    // Enlaces: [texto](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: inherit; text-decoration: underline;">$1</a>')
    
    // Saltos de línea a <br>
    .replace(/\n/g, '<br>');

  return html;
}
</script>

<style scoped>
.text-block-reader {
  width: 100%;
  box-sizing: border-box;
}
/* Asegurar que los estilos internos del v-html hereden correctamente */
.text-block-reader :deep(p) {
  margin: 0;
}
.text-block-reader :deep(strong) {
  font-weight: bold;
}
.text-block-reader :deep(em) {
  font-style: italic;
}
</style>