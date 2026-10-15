<template>
<!--   <div v-if="editorStore.receivedVariables" class="debug-variables text-black">
    <h3>Variables Recibidas:</h3>
    <pre >{{ JSON.stringify(editorStore.receivedVariables, null, 2) }}</pre>
  </div> -->

  <div id="preview"></div>

  <UApp>
    <Editor />
  </UApp>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import Editor from './App/index.vue'
import { useInspectorDrawer } from './documents/editor/editor.store';
import { isFromParent } from './utils/allowedOrigins';
import getConfiguration from './getConfiguration';

const editorStore = useInspectorDrawer();

// Escuchar los mensajes desde el padre (página principal)
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (!isFromParent(event)) {
      if (event.data?.type) console.warn('Mensaje ignorado, origen no seguro:', event.origin);
      return;
    }

    const data = event.data;

    if (!data || typeof data !== 'object' || !data.type || !['updateVariables', 'addVariable', 'requestHtml', 'loadTemplate', "requestJson", "requestHtmlAndJson", "clearTemplate", "setToken"].includes(data.type)) {
      return;
    }

     switch (data.type) {  
      case 'updateVariables':  
        {
          const vars = toStringRecord(data.variables);
          if (vars) editorStore.receiveVariablesFromParent(vars);
        }
        break;  
      case 'addVariable':  
        if (typeof data.variable?.key === 'string' && isPrimitive(data.variable?.value)) {
          editorStore.addVariableFromParent(data.variable.key, String(data.variable.value));
        }
        break;  
      case 'requestHtml':  
        await editorStore.sendHtmlToParent();  
        break;  
      case 'loadTemplate':  
        if (data.template && typeof data.template === 'object'){
          editorStore.loadTemplateFromParent(data.template); 
        } 
        break; 
      case 'requestJson':  
        await editorStore.exportJsonToParent();  
        break; 
      case 'requestHtmlAndJson':
        console.log('[Builder] requestHtmlAndJson received');
        await editorStore.exportHtmlAndJsonToParent();
        break;
      case 'clearTemplate':  
        editorStore.resetDocument(getConfiguration(''));  
        break; 
      case 'setToken':
        /* console.log('🎯 Case setToken ejecutado');
        console.log('🔑 Token recibido:', data.token); */
        if (typeof data.token === 'string' && data.token.length > 0 && data.token.length <= 4096) {
          editorStore.setAuthToken(data.token);
        }
        break;
      default:
        /* console.log('Mensaje no reconocido:', data); */
     }
  });
});

onUnmounted(() => {})

function isPrimitive(x: unknown): x is string | number | boolean {
  return typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean';
}

// Variables from the parent: plain object of primitives, coerced to strings
// (nested objects/functions are dropped instead of reaching the store).
function toStringRecord(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (isPrimitive(x)) out[k] = String(x);
  }
  return out;
}
</script>

<style scoped>
/* .debug-variables {
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  padding: 10px;
  margin: 10px;
  font-family: monospace;
  white-space: pre-wrap;
} */
</style>