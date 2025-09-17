<template>    
  <div class="p-4 space-y-4">    
    <div class="flex items-center justify-between">    
      <h3 class="text-lg font-semibold">Variables dinámicas</h3>    
      <div class="flex gap-2">    
        <UButton     
          @click="exportVariables"     
          label="Exportar"     
          icon="material-symbols:download"    
          variant="outline"    
          size="sm"    
        />    
        <UButton     
          @click="triggerImport"     
          label="Importar"     
          icon="material-symbols:upload"    
          variant="outline"    
          size="sm"    
        />    
      </div>    
    </div>    
    
    <!-- Lista de variables existentes -->    
    <div class="space-y-3">    
      <div v-for="(value, key) in inspectorDrawer.globalVariables" :key="variableIds[key] || key" class="flex gap-2 items-center">    
        <UInput     
          :model-value="key"     
          placeholder="Nombre de la variable"    
          @update:model-value="updateVariableKey(key, $event)"    
          class="flex-1"    
        />    
        <UInput     
          :model-value="value"     
          placeholder="Valor de la variable"    
          @update:model-value="updateVariableValue(key, $event)"    
          class="flex-1"    
        />    
        <UButton     
          icon="material-symbols:delete"     
          color="warning"     
          variant="ghost"    
          size="sm"    
          @click="removeVariable(key)"     
        />    
      </div>    
          
      <!-- Botón para agregar variable -->    
      <UButton     
        @click="addVariable"     
        label="Agregar variable"     
        icon="material-symbols:add"    
        size="sm"    
        class="w-full"    
      />    
    </div>    
    
    <!-- Input oculto para importar archivos -->    
    <input     
      ref="fileInput"    
      type="file"     
      accept=".json"    
      @change="handleFileImport"    
      style="display: none"    
    />    
        
    <!-- Preview de variables -->    
    <div v-if="Object.keys(inspectorDrawer.globalVariables).length > 0" class="mt-6">    
      <h4 class="text-sm font-medium mb-2">Vista previa</h4>    
      <div class="p-3 bg-gray-50 rounded-md text-sm text-black">    
        <div v-for="(value, key) in inspectorDrawer.globalVariables" :key="key" class="flex justify-between text-black">    
          <span class="font-mono">{{ formatVariableName(key) }}</span>    
          <span class="">→ {{ value }}</span>    
        </div>    
      </div>    
    </div>    
    
    <!-- Instrucciones de uso -->    
    <div class="mt-6 p-3 bg-blue-50 rounded-md">    
      <h4 class="text-sm font-medium text-blue-900 mb-1">Cómo usar</h4>    
      <p class="text-xs text-blue-700">    
        Usa <code class="bg-blue-100 px-1 rounded">{{ formatVariableName('variableName') }}</code> in your text blocks to insert dynamic content.    
      </p>    
    </div>    
  </div>    
</template>    
    
<script setup lang="ts">    
import { useInspectorDrawer } from '../../documents/editor/editor.store';    
import { ref } from 'vue';    
    
const inspectorDrawer = useInspectorDrawer()    
const fileInput = ref<HTMLInputElement | null>(null)  
const variableIds = ref<Record<string, string>>({});  
  
// Función para formatear nombres de variables  
function formatVariableName(key: string): string {  
  return `{{${key}}}`  
}  
    
// Gestión de Variables    
function addVariable() {    
  const timestamp = Date.now()    
  const key = `variable_${timestamp}`
  const id = `var_${timestamp}`

  variableIds.value[key] = id
  const newVariables = {    
    ...inspectorDrawer.globalVariables,    
    [key]: ''    
  }    
  inspectorDrawer.setGlobalVariables(newVariables)    
}    
    
function removeVariable(key: string) {    
  const newVariables = { ...inspectorDrawer.globalVariables }    
  delete newVariables[key]    
  inspectorDrawer.setGlobalVariables(newVariables)    
}    
    
function updateVariableKey(oldKey: string, newKey: string) {
  if (!newKey || newKey === oldKey) return
  if (inspectorDrawer.globalVariables[newKey]) return // evita colisiones

  const value = inspectorDrawer.globalVariables[oldKey]
  const newVariables: Record<string, string> = {}

  Object.keys(inspectorDrawer.globalVariables).forEach(key => {
    if (key === oldKey) {
      newVariables[newKey] = value
    } else {
      newVariables[key] = inspectorDrawer.globalVariables[key]
    }
  })

  // reemplazamos todo el objeto para que Vue detecte el cambio
  inspectorDrawer.setGlobalVariables(newVariables)

  // actualizar el map de IDs también
  const id = variableIds.value[oldKey]
  delete variableIds.value[oldKey]
  variableIds.value[newKey] = id
} 
    
function updateVariableValue(key: string, value: string) {    
  /* const newVariables = {    
    ...inspectorDrawer.globalVariables,    
    [key]: value    
  }    
  inspectorDrawer.setGlobalVariables(newVariables) */   
   inspectorDrawer.globalVariables[key] = value; 
}    
    
// Exportar Variables (solo las variables, sin metadatos)    
function exportVariables() {    
  const blob = new Blob([JSON.stringify(inspectorDrawer.globalVariables, null, 2)], {    
    type: 'application/json'    
  })    
      
  const url = URL.createObjectURL(blob)    
  const a = document.createElement('a')    
  a.href = url    
  a.download = `variables-${Date.now()}.json`    
  document.body.appendChild(a)    
  a.click()    
  document.body.removeChild(a)    
  URL.revokeObjectURL(url)    
}    
    
// Importar Variables    
function triggerImport() {    
  fileInput.value?.click()    
}    
    
function handleFileImport(event: Event) {    
  const target = event.target as HTMLInputElement    
  const file = target.files?.[0]    
      
  if (file) {    
    const reader = new FileReader()    
    reader.onload = (e) => {    
      try {    
        const content = e.target?.result as string    
        importVariables(content)    
      } catch (error) {    
        console.error('Error reading file:', error)    
      }    
    }    
    reader.readAsText(file)    
  }    
}    
    
function importVariables(jsonString: string) {    
  try {    
    const data = JSON.parse(jsonString)    
        
    if (typeof data === 'object' && data !== null) {    
      // Merge con variables existentes    
      const newVariables = {     
        ...inspectorDrawer.globalVariables,     
        ...data     
      }    
      inspectorDrawer.setGlobalVariables(newVariables)    
      console.log('Variables imported successfully')    
    } else {    
      throw new Error('Invalid variables format')    
    }    
  } catch (error) {    
    console.error('Invalid variables JSON:', error)    
  }    
}     
</script>