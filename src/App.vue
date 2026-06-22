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
import { isOriginAllowed } from './utils/allowedOrigins';
import getConfiguration from './getConfiguration';

const editorStore = useInspectorDrawer();

// Escuchar los mensajes desde el padre (página principal)
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (!isOriginAllowed(event.origin)) {
      console.warn('Mensaje ignorado, origen no seguro:', event.origin);
      return;
    }

    const data = event.data;

    if (!data.type || !['updateVariables', 'addVariable', 'requestHtml', 'loadTemplate', "requestJson", "requestHtmlAndJson", "clearTemplate", "setToken"].includes(data.type)) {
      return;
    }

     switch (data.type) {  
      case 'updateVariables':  
        editorStore.receiveVariablesFromParent(data.variables);  
        break;  
      case 'addVariable':  
        editorStore.addVariableFromParent(data.variable.key, data.variable.value);  
        break;  
      case 'requestHtml':  
        await editorStore.sendHtmlToParent();  
        break;  
      case 'loadTemplate':  
        if (data.template){
          editorStore.loadTemplateFromParent(data.template); 
        } 
        break; 
      case 'requestJson':  
        await editorStore.exportJsonToParent();  
        break; 
      case 'requestHtmlAndJson':  
        await editorStore.exportHtmlAndJsonToParent();  
        break; 
      case 'clearTemplate':  
        editorStore.resetDocument(getConfiguration(''));  
        break; 
      case 'setToken':
        /* console.log('🎯 Case setToken ejecutado');
        console.log('🔑 Token recibido:', data.token); */
        editorStore.setAuthToken(data.token);
        break;
      default:
        /* console.log('Mensaje no reconocido:', data); */
     }
  });
});

onUnmounted(() => {})
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