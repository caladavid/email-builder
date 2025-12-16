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
import { ref, onMounted, onUnmounted } from 'vue';
import Editor from './App/index.vue'
import { useInspectorDrawer } from './documents/editor/editor.store';
import { isOriginAllowed } from './utils/allowedOrigins';
import getConfiguration from './getConfiguration';

const editorStore = useInspectorDrawer();

function handleKeyboardShortcuts(event: KeyboardEvent){
  const activeElement = document.activeElement;

  const isTextEditor = activeElement?.classList.contains('inline-text-editor') ||
                      activeElement?.classList.contains('rich-text-editable');

  if (isTextEditor) return;
  // Ctrl+Z para undo  
  if (event.ctrlKey && event.key === "z" && !event.shiftKey){
    event.preventDefault();

    if (editorStore.canUndo()){
      editorStore.undo();
    }
  }

   // Ctrl+Y
   if(event.ctrlKey && event.key === "y"){
    event.preventDefault();

    if (editorStore.canRedo()){
      editorStore.redo();
    }
   } 
}

// Escuchar los mensajes desde el padre (página principal)
onMounted(() => {
  window.addEventListener('message', async (event) => {
    // El origen del mensaje DEBE COINCIDIR con la URL del padre.
    // Si tu app padre está en http://localhost:3000, ese es el origen correcto.
/*     if (event.origin !== 'http://localhost:3000' && event.origin !== 'http://email-builder.celcomlatam.com/ && event.origin !== "http://localhost:5173") {
      console.warn('Mensaje ignorado, origen no seguro:', event.origin);
      return;
    } */

/*    if (!isOriginAllowed(event.origin)){
    console.warn('Mensaje ignorado, origen no seguro:', event.origin);
    return;
   } */

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
        editorStore.setAuthToken(data.token);  
        break; 
      default:  
        console.log('Mensaje no reconocido:', data); 
     }
  });

  window.addEventListener('keydown', handleKeyboardShortcuts);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboardShortcuts);
})
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