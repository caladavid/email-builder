<template class="z-50">  
  <UModal 
      class="z-50"
      v-model:open="open" 
      title="Importar plantilla" 
      :ui="{ 
        close: 'cursor-pointer', 
        wrapper: 'import-modal-high-z'    
        }">  
    <UTooltip text="Importar plantilla">  
      <UButton  
        variant="ghost"  
        color="neutral"  
        icon="material-symbols:upload"  
        class="cursor-pointer"  
      />  
    </UTooltip>  
  
    <template #body>  
      <div class="space-y-4 z-50">  
        <UTabs :items="importTabs" variant="link">  
          <template #json>  
            <div class="space-y-4">  
              <p>  
                Copia y pega un JSON (<a  
                  href="https://gist.githubusercontent.com/jordanisip/efb61f56ba71bd36d3a9440122cb7f50/raw/30ea74a6ac7e52ebdc309bce07b71a9286ce2526/emailBuilderTemplate.json"  
                  target="_blank"  
                  class="text-blue-500 hover:underline"  
                >ejemplo</a>).  
              </p>  
  
              <UAlert v-if="error" variant="subtle" color="error" :title="error" />  
  
              <form @submit.prevent="handleSubmit">  
                <UTextarea  
                  variant="outline"  
                  required  
                  :highlight="error !== null"  
                  :color="error ? 'error' : 'neutral'"  
                  :rows="10"  
                  class="w-full"  
                  v-model="value"  
                  @update:model-value="handleChange"  
                />  
              </form>  
  
              <p class="text-xs mt-2">Esto sobrescribirá tu plantilla actual.</p>  
            </div>  
          </template>  
  
          <template #zip>  
            <div class="space-y-4">  
              <p>  
                Sube un archivo ZIP que contenga un archivo index.html y una carpeta de imágenes.  
              </p>  
  
              <UAlert v-if="zipError" variant="subtle" color="error" :title="zipError" />  
              <UAlert v-if="zipSuccess" variant="subtle" color="success" :title="zipSuccess" />  
  
              <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">  
                <input  
                  ref="zipFileInput"  
                  type="file"  
                  accept=".zip"  
                  @change="handleZipUpload"  
                  class="hidden"  
                />  
                <UButton  
                  @click="$refs.zipFileInput?.click()"  
                  icon="material-symbols:upload"  
                  label="Seleccionar archivo ZIP"  
                  variant="outline"  
                />  
                <p class="mt-2 text-sm text-gray-500">  
                  El ZIP debe contener un archivo index.html y una carpeta de imágenes  
                </p>  
              </div>  
                
              <div v-if="zipProcessing" class="text-center">  
                <p>Procesando archivo ZIP...</p>  
              </div>  
            </div>  
          </template>  
        </UTabs>  
      </div>  
    </template>  
  
    <template #footer>  
      <div class="flex justify-end w-full gap-2 z-50">  
        <UButton variant="ghost" color="neutral" label="Cancelar" @click="handleCancel" class="cursor-pointer" />  
        <UButton   
          label="Importar"   
          @click="handleSubmit"   
          :disabled="(activeTab === 'json' && error !== null) || zipProcessing"   
          class="cursor-pointer"   
        />  
      </div>  
    </template>  
  </UModal>  
</template>  

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
import validateJsonStringValue from './validateJsonStringValue';
import JSZip from 'jszip';  
import { HTMLToBlockParser } from '../../../utils/parsers/HTMLToBlockParser';
/* import { HTMLToBlockParser } from './htmlParser';  */

const inspectorDrawer = useInspectorDrawer()

/** Refs */

const value = ref('')
const error = ref<string | null>(null);
const zipError = ref<string | null>(null);
const zipSuccess = ref<string | null>(null);
const zipProcessing = ref(false);
const open = ref(false);
const activeTab = ref('json');
const zipFileInput = ref<HTMLInputElement | null>(null)

/** Computed */  
const importTabs = computed(() => [
  {
    key: 'json',
    label: 'Importar JSON',
    slot: "json"
  }, 
  {
    key: 'zip',
    label: 'Importar ZIP',
    slot: "zip"
  }
]);

/** Functions */

function handleChange(v: string) {
  value.value = v
  error.value = validateJsonStringValue(v).error ?? null
}

function handleSubmit() {
  if (activeTab.value === "json") {
    const { error: err, data } = validateJsonStringValue(value.value)
    error.value = err ?? null

    if (!data) return

    inspectorDrawer.resetDocument(data)
    handleCancel();
  }
}

function handleCancel() {
  open.value = false;
  value.value = '';
  error.value = null;  
  zipError.value = null;  
  zipSuccess.value = null;  
  zipProcessing.value = false;  
  activeTab.value = 'json';  
}

/* async function handleZipUpload(event: Event) {    
  const file = (event.target as HTMLInputElement).files?.[0];    
  if (!file) return;  
 
    
  zipProcessing.value = true;    
  zipError.value = null;    
  zipSuccess.value = null;    
    
  try {    
    const currentOrigin = window.location.origin;

    if (currentOrigin.includes('localhost:3000') || currentOrigin.includes('localhost:5173')) {

      const parser = new HTMLToBlockParser();   
      const result = await parser.parseZipToBlocks(file);  
        
      // Separar errores críticos de advertencias  
      const criticalErrors = result.errors.filter(e => !e.recoverable);  
      const warnings = result.errors.filter(e => e.recoverable);  
        
      if (criticalErrors.length > 0) {  
        // Mostrar solo errores críticos  
        const errorMessage = criticalErrors  
          .map(e => `${e.type}: ${e.message}`)  
          .join('\n');  
        zipError.value = errorMessage;  
        return;  
      }  
        
      // Mostrar advertencias informativas si existen  
      if (warnings.length > 0) {  
        console.error('Advertencias durante la importación:', warnings);  
        // Opcional: mostrar advertencias al usuario  
        // zipWarning.value = warnings.map(w => w.message).join('\n');  
      }  
        
      // Continuar con la importación si no hay errores críticos  
      if (result.configuration) { 
        inspectorDrawer.resetDocument(result.configuration);  
        zipSuccess.value = 'ZIP importado exitosamente';  
          
        setTimeout(() => {    
          handleCancel();    
        }, 1500);  
      }  

    } else {
      await inspectorDrawer.sendZip(file);        
      zipSuccess.value = 'Plantilla importada exitosamente';     
        
      setTimeout(() => {      
        handleCancel();      
      }, 1500);
    }
      
  } catch (error) {    
    console.error('❌ Error processing ZIP:', error);    
    zipError.value = 'Error al procesar el archivo ZIP';    
  } finally {    
    zipProcessing.value = false;    
  }    
} */

async function handleZipUpload(event: Event) {    
  const file = (event.target as HTMLInputElement).files?.[0];    
  if (!file) return;  
  await inspectorDrawer.sendZip(file);    
    
  zipProcessing.value = true;    
  zipError.value = null;    
  zipSuccess.value = null;    
    
  try {    
    const parser = new HTMLToBlockParser();    
    const result = await parser.parseZipToBlocks(file);  
      
    // Separar errores críticos de advertencias  
    const criticalErrors = result.errors.filter(e => !e.recoverable);  
    const warnings = result.errors.filter(e => e.recoverable);  
      
    if (criticalErrors.length > 0) {  
      // Mostrar solo errores críticos  
      const errorMessage = criticalErrors  
        .map(e => `${e.type}: ${e.message}`)  
        .join('\n');  
      zipError.value = errorMessage;  
      return;  
    }  
      
    // Mostrar advertencias informativas si existen  
    if (warnings.length > 0) {  
      console.warn('Advertencias durante la importación:', warnings);  
      // Opcional: mostrar advertencias al usuario  
      // zipWarning.value = warnings.map(w => w.message).join('\n');  
    }  
      
    // Continuar con la importación si no hay errores críticos  
    if (result.configuration) {  
      inspectorDrawer.resetDocument(result.configuration);  
      zipSuccess.value = 'ZIP importado exitosamente';  
        
      setTimeout(() => {    
        handleCancel();    
      }, 1500);  
    }  
      
  } catch (error) {    
    console.error('❌ Error processing ZIP:', error);    
    zipError.value = 'Error al procesar el archivo ZIP';    
  } finally {    
    zipProcessing.value = false;    
  }    
}

function isImageFile(filename: string): boolean {  
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];  
  const extension = filename.split('.').pop()?.toLowerCase();  
  return imageExtensions.includes(extension || '');  
}

function getMimeType(extension: string): string {
  const mimeTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',  
    'jpeg': 'image/jpeg',  
    'png': 'image/png',  
    'gif': 'image/gif',  
    'webp': 'image/webp',  
    'svg': 'image/svg+xml'  
  };
   return mimeTypes[extension] || 'image/jpeg';  
}


</script>
<style>
/* Sobrescribir z-index del modal de Nuxt UI */  
[data-headlessui-portal] {  
  z-index: 10000 !important;  
}  
  
/* Sobrescribir z-index del overlay/backdrop */  
[data-headlessui-portal] > div[data-headlessui-state] {  
  z-index: 9999 !important;  
}  
  
/* Alternativa: usar clases de Nuxt UI */  
.fixed.inset-0[role="dialog"] {  
  z-index: 10000 !important;  
}  
</style>