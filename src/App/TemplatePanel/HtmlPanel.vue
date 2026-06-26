<template>
  <HighlightedCodePanel type="html" :value="code" />
</template>

<script setup lang="ts">
import HighlightedCodePanel from './helper/HighlightedCodePanel.vue'
import { useInspectorDrawer } from '../../documents/editor/editor.store'
import { computed, ref, watch } from 'vue';
import { renderToStaticMarkup } from '../../lib/email-builder';
import { createProcessedDocument } from '../../utils/documentProcessor';

const inspectorDrawer = useInspectorDrawer()

const code = ref<string>('')

const processedDocument = computed(() =>
  createProcessedDocument(inspectorDrawer.document, inspectorDrawer.globalVariables)
);

let _lastRenderKey = '';
let _lastRenderHtml = '';

// Iframe mode: rawHtml is source of truth
watch(() => inspectorDrawer.rawHtml, (html) => {
  if (html) code.value = html;
}, { immediate: true });

// Block mode: render from JSON document
watch(() => [inspectorDrawer.document, inspectorDrawer.globalVariables], async () => {
  if (inspectorDrawer.rawHtml) return;
  const key = JSON.stringify(processedDocument.value);
  if (key === _lastRenderKey) { code.value = _lastRenderHtml; return; }
  try {
    const html = await renderToStaticMarkup(processedDocument.value, { rootBlockId: 'root' });
    _lastRenderKey = key;
    _lastRenderHtml = html;
    code.value = html;
  } catch (e) {
    console.warn('renderToStaticMarkup failed in HtmlPanel:', e);
  }
}, { immediate: true, deep: true })
</script>
