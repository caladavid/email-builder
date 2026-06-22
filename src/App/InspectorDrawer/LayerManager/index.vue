<template>
  <div style="height:100%;display:flex;flex-direction:column;overflow:hidden;">
    <!-- Header -->
    <div style="padding:8px 12px;border-bottom:1px solid var(--ui-border);display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:12px;font-weight:600;color:var(--color-blue);">Capas</span>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="material-symbols:refresh"
        title="Refrescar árbol"
        @click="requestTree"
      />
    </div>

    <!-- No iframe mode notice -->
    <div v-if="!store.rawHtml" style="padding:16px;font-size:12px;color:#888;text-align:center;">
      Importa un email ZIP para ver las capas aquí.
    </div>

    <!-- Tree -->
    <div v-else style="overflow-y:auto;flex:1;padding:4px;">
      <div v-if="!tree" style="padding:16px;font-size:12px;color:#888;text-align:center;">
        Cargando árbol…
      </div>
      <LayerItem
        v-else
        :node="tree"
        :depth="0"
        :selected-path="store.selectedElementPath"
        @select="handleSelectPath"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
import { sendToCanvas } from '../../../composables/useCanvasBridge';
import LayerItem, { type DomNode } from './LayerItem.vue';

const store = useInspectorDrawer();
const tree = ref<DomNode | null>(null);

function requestTree() {
  sendToCanvas({ type: 'get-tree' });
}

function handleMessage(event: MessageEvent) {
  if (event.data?.type === 'tree-response' && event.data.tree) {
    tree.value = event.data.tree;
  }
}

function handleSelectPath(path: string) {
  store.selectedElementPath = path;
  sendToCanvas({ type: 'highlight', path });
  store.inspectorDrawerOpen = true;
}

watch(
  () => store.rawHtml,
  (html) => {
    if (html) {
      tree.value = null;
      // Give iframe time to load then request tree
      setTimeout(requestTree, 500);
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('message', handleMessage);
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
});
</script>
