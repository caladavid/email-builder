<template>
  <div v-if="editorStore.receivedVariables" class="debug-variables text-black">
    <h3>Variables Recibidas:</h3>
    <pre >{{ JSON.stringify(editorStore.receivedVariables, null, 2) }}</pre>
  </div>

  <UApp>
    <Editor />
  </UApp>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Editor from './App/index.vue'
import { useInspectorDrawer } from './documents/editor/editor.store';

const editorStore = useInspectorDrawer();

// Escuchar los mensajes desde el padre (página principal)
onMounted(() => {
  window.addEventListener('message', (event) => {
    // El origen del mensaje DEBE COINCIDIR con la URL del padre.
    // Si tu app padre está en http://localhost:3000, ese es el origen correcto.
    if (event.origin !== 'http://localhost:3000' && event.origin !== 'http://email-builder.multinetlabs.com/') {
      /* console.warn('Mensaje ignorado, origen no seguro:', event.origin); */
      return;
    }
    
    const data = event.data;

    if (!data.type || !['updateVariables', 'addVariable'].includes(data.type)) {    
      return;  
    } 

     switch (data.type) {  
      case 'updateVariables':  
        editorStore.receiveVariablesFromParent(data.variables);  
        break;  
      case 'addVariable':  
        editorStore.addVariableFromParent(data.variable.key, data.variable.value);  
        break;  
      default:  
        console.log('Mensaje no reconocido:', data); 
     }
    /* if (data.type === 'updateVariables') {
      editorStore.receivedVariables = data.variables;
      console.log('¡Mensaje recibido correctamente en el iframe hijo!', data.variables); // Añadido para depurar
    } */
  });
});
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