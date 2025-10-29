<template>  
  <UModal v-model:open="open" title="Variables dinámicas" :ui="{ close: 'cursor-pointer' }">  
    <UTooltip text="Variables">  
      <UButton  
        variant="ghost"  
        color="neutral"  
        icon="material-symbols:code"  
        class="cursor-pointer"  
      />  
    </UTooltip>  
  
    <template #body>  
      <div class="space-y-4">  
        <div class="flex items-center justify-between">  
          <h3 class="text-lg font-semibold">Variables dinámicas</h3>  
          <!-- <div class="flex gap-2">  
            <UButton   
              @click="exportVariables"   
              label="Export"   
              icon="material-symbols:download"  
              variant="outline"  
              size="sm"  
            />  
            <UButton   
              @click="triggerImport"   
              label="Import"   
              icon="material-symbols:upload"  
              variant="outline"  
              size="sm"  
            />  
          </div> -->  
        </div>  
  
        <!-- Lista de variables existentes -->  
        <div class="space-y-3 max-h-96 overflow-y-auto">  
          <div v-for="(item, index) in variablesList" :key="item.id" class="flex gap-2 items-center">  
            <UInput   
              :model-value="item.key"   
              placeholder="Nombre de la variable"  
              @update:model-value="updateVariableKey(index, $event)"  
              class="flex-1"  
            />  
            <UInput   
              :model-value="item.value"   
              placeholder="Valor de la variable"  
              @update:model-value="updateVariableValue(index, $event)"  
              class="flex-1"  
            />  
            <UButton   
              icon="material-symbols:delete"   
              color="warning"   
              variant="ghost"  
              size="sm"  
              @click="removeVariable(index)"   
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
  
        <!-- Preview de variables -->  
        <!-- <div v-if="Object.keys(inspectorDrawer.globalVariables).length > 0" class="mt-6">  
          <h4 class="text-sm font-medium mb-2">Vista previa</h4>  
          <div class="p-3 bg-gray-50 rounded-md text-sm max-h-32 overflow-y-auto">  
            <div v-for="(value, key) in inspectorDrawer.globalVariables" :key="key" class="flex justify-between">  
              <span class="font-mono">{{ formatVariableName(key) }}</span>  
              <span>→ {{ value }}</span>  
            </div>  
          </div>  
        </div>  --> 
  
        <!-- Instrucciones de uso -->  
        <div class="mt-6 p-3 bg-blue-50 rounded-md">  
          <h4 class="text-sm font-medium text-blue-900 mb-1">Cómo usar</h4>  
          <p class="text-xs text-blue-700">  
            Usa <code class="bg-blue-100 px-1 rounded">{{ formatVariableName('variableName') }}</code> en tus bloques de texto para insertar contenido dinámico.  
          </p>  
        </div>  
  
        <!-- Input oculto para importar archivos -->  
        <input   
          ref="fileInput"  
          type="file"   
          accept=".json"  
          @change="handleFileImport"  
          style="display: none"  
        />  
      </div>  
    </template>  
  
    <template #footer>  
      <div class="flex justify-end w-full gap-2">  
        <UButton variant="ghost" color="neutral" label="Close" @click="open = false" class="cursor-pointer" />  
      </div>  
    </template>  
  </UModal>  
</template>  
  
<script setup lang="ts">  
import { computed, ref } from 'vue';  
import { useInspectorDrawer } from '../../documents/editor/editor.store';  
  
const inspectorDrawer = useInspectorDrawer()  
const fileInput = ref<HTMLInputElement | null>(null)  
const open = ref(false)  
const variableIds = ref<Map<string, string>>(new Map())

const variablesList = computed(() => {  
  return Object.entries(inspectorDrawer.globalVariables).map(([key, value]) => {  
    // Generar ID estable solo si no existe  
    if (!variableIds.value.has(key)) {  
      variableIds.value.set(key, `var-${Date.now()}-${Math.random()}`)  
    }  
      
    return {  
      id: variableIds.value.get(key)!, // ID estable que no cambia  
      key,  
      value  
    }  
  })  
}) 
  
// Función para formatear nombres de variables  
function formatVariableName(key: string): string {  
  return `[[[${key}]]]`  
}  
  
// Gestión de Variables  
function addVariable() {  
  const timestamp = Date.now()  
  const key = `variable_${timestamp}`  
  /* const newVariables = {  
    ...inspectorDrawer.globalVariables,  
    [key]: ''  
  }  
  inspectorDrawer.setGlobalVariables(newVariables)   */

  variableIds.value.set(key, `var-${timestamp}-${Math.random()}`) 
  
  inspectorDrawer.setGlobalVariables({
    ...inspectorDrawer.globalVariables,
    [key]: ''
  })
}  
  
  
/* function updateVariableKey(oldKey: string, newKey: string) {  
  if (newKey && newKey !== oldKey && !inspectorDrawer.globalVariables[newKey]) {  
    const value = inspectorDrawer.globalVariables[oldKey]  
    const newVariables = { ...inspectorDrawer.globalVariables }  
    delete newVariables[oldKey]  
    newVariables[newKey] = value  
    inspectorDrawer.setGlobalVariables(newVariables)  
  }  
}   */

function updateVariableKey(index: number, newKey: string) {  
  const item = variablesList.value[index]  
  if (!newKey || newKey === item.key || inspectorDrawer.globalVariables[newKey]) return  
  
  const oldKey = item.key  
  const value = item.value  
    
  // Actualizar el mapa de IDs  
  const stableId = variableIds.value.get(oldKey)!  
  variableIds.value.delete(oldKey)  
  variableIds.value.set(newKey, stableId)  
    
  // Actualizar las variables  
  const newVariables = { ...inspectorDrawer.globalVariables }  
  delete newVariables[oldKey]  
  newVariables[newKey] = value  
  inspectorDrawer.setGlobalVariables(newVariables)  
} 
  
/* function updateVariableValue(key: string, value: string) {  
  const newVariables = {  
    ...inspectorDrawer.globalVariables,  
    [key]: value  
  }  
  inspectorDrawer.setGlobalVariables(newVariables)  
}   */

function updateVariableValue(index: number, newValue: string) {  
  const item = variablesList.value[index]  
  const newVariables = {  
    ...inspectorDrawer.globalVariables,  
    [item.key]: newValue  
  }  
  inspectorDrawer.setGlobalVariables(newVariables)  
} 

function removeVariable(index: number) {  
  const item = variablesList.value[index]  
    
  // Limpiar el ID del mapa  
  variableIds.value.delete(item.key)  
    
  const newVariables = { ...inspectorDrawer.globalVariables }  
  delete newVariables[item.key]  
  inspectorDrawer.setGlobalVariables(newVariables)  
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
        const data = JSON.parse(content)  
          
        if (typeof data === 'object' && data !== null) {  
          const newVariables = {   
            ...inspectorDrawer.globalVariables,   
            ...data   
          }  
          inspectorDrawer.setGlobalVariables(newVariables)  
          console.log('Variables imported successfully')  
        }  
      } catch (error) {  
        console.error('Invalid variables JSON:', error)  
      }  
    }  
    reader.readAsText(file)  
  }  
}  
</script>