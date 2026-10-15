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
import { isFromParent, isOriginAllowed } from './utils/allowedOrigins';
import getConfiguration from './getConfiguration';

const editorStore = useInspectorDrawer();

// Escuchar los mensajes desde el padre (página principal)
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (!isFromParent(event)) {
      if (event.data?.type) {
        // Diagnóstico (sin datos sensibles): distingue origen no permitido de
        // remitente que no es el padre directo del iframe
        console.warn('[Builder] Mensaje ignorado:', {
          type: event.data.type,
          origin: event.origin,
          originPermitido: isOriginAllowed(event.origin),
          remitenteEsPadre: event.source === window.parent,
        });
      }
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
        {
          // Acepta string o número (se convierte); rechaza vacío/objetos.
          // Nunca se loguea el valor del token, solo su tipo y largo.
          const t = typeof data.token === 'number' ? String(data.token) : data.token;
          if (typeof t === 'string' && t.trim().length > 0 && t.length <= 65536) {
            editorStore.setAuthToken(t.trim());
          } else {
            console.warn('[Builder] setToken ignorado: token inválido', {
              tipo: typeof data.token,
              largo: typeof data.token === 'string' ? data.token.length : null,
            });
          }
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