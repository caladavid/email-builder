<template class="z-50">  
  <UModal 
      class="z-10"
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
        <UTabs :items="importTabs" variant="link" v-model="activeTab">  
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

          <template #html>
            <div class="space-y-4">
              <p>Pega el código HTML de tu plantilla.</p>
              <UAlert v-if="htmlError" variant="subtle" color="error" :title="htmlError" />
              <UTextarea
                variant="outline"
                :rows="10"
                class="w-full"
                v-model="htmlCode"
                placeholder="<!DOCTYPE html>..."
              />
              <p class="text-xs mt-2">Esto sobrescribirá tu plantilla actual.</p>
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
          :disabled="(activeTab === 'json' && error !== null) || zipProcessing || (activeTab === 'html' && htmlError !== null)"   
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
const htmlCode = ref('')
const htmlError = ref<string | null>(null)

/** Computed */  
const importTabs = computed(() => [
  { value: 'json', label: 'Importar JSON', slot: 'json' },
  { value: 'zip',  label: 'Importar ZIP',  slot: 'zip'  },
  { value: 'html', label: 'Importar HTML', slot: 'html' },
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
  } else if (activeTab.value === 'html') {
    if (!htmlCode.value.trim()) {
      htmlError.value = 'El código HTML no puede estar vacío';
      return;
    }
    inspectorDrawer.importRawHtml(htmlCode.value);
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
  htmlCode.value = '';
  htmlError.value = null;
  activeTab.value = 'json';
}

async function handleZipUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  zipProcessing.value = true;
  zipError.value = null;
  zipSuccess.value = null;

  try {
    const currentOrigin = window.location.origin;

    if (currentOrigin.includes('localhost:3000') || currentOrigin.includes('localhost:5173')) {
      // Local: extract HTML + embed images as base64 (no backend call)
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);

      const htmlFile = zip.file('index.html') ?? zip.file(/\.html$/i)[0] ?? null;
      if (!htmlFile) {
        zipError.value = 'No se encontró un archivo HTML en el ZIP';
        return;
      }
      let htmlContent = await htmlFile.async('string');

      // Build image map: full path + basename for flexible lookup
      const imageMap = new Map<string, string>();
      const imageEntries = Object.entries(zip.files).filter(
        ([name]) => isImageFile(name) && !zip.files[name].dir
      );
      await Promise.all(imageEntries.map(async ([name, entry]) => {
        try {
          const b64 = await entry.async('base64');
          const ext = name.split('.').pop()?.toLowerCase() ?? 'png';
          const dataUri = `data:${getMimeType(ext)};base64,${b64}`;
          imageMap.set(name, dataUri);
          imageMap.set(name.replace(/^.*[\\/]/, ''), dataUri); // basename fallback
        } catch { /* skip unreadable entries */ }
      }));

      if (imageMap.size > 0) {
        // Upload each unique base64 to CDN; fall back to base64 if no token/error
        const uniqueDataUris = Array.from(new Set(imageMap.values()));
        const dataUriToCdn = new Map<string, string>();
        await Promise.all(uniqueDataUris.map(async (dataUri) => {
          const cdn = await inspectorDrawer.convertBase64ToService(dataUri);
          dataUriToCdn.set(dataUri, cdn);
        }));
        for (const [key, dataUri] of imageMap.entries()) {
          imageMap.set(key, dataUriToCdn.get(dataUri) ?? dataUri);
        }

        const resolveUri = (src: string) => {
          if (/^(https?:\/\/|data:|cid:)/i.test(src)) return null;
          return imageMap.get(src) ?? imageMap.get(src.replace(/^.*[\\/]/, '')) ?? null;
        };

        // <img src="..." and <img src='...'> — \b avoids the \s bug where first-attr src fails
        htmlContent = htmlContent.replace(
          /(<img[^>]+\bsrc=)(["'])([^"']+)\2/gi,
          (match, pre, q, src) => { const uri = resolveUri(src); return uri ? `${pre}${q}${uri}${q}` : match; }
        );
        // background="..." on <td> etc.
        htmlContent = htmlContent.replace(
          /(\bbackground=)(["'])([^"']+)\2/gi,
          (match, pre, q, src) => { const uri = resolveUri(src); return uri ? `${pre}${q}${uri}${q}` : match; }
        );
        // CSS url() in inline styles and <style> blocks
        htmlContent = htmlContent.replace(
          /url\((['"]?)([^'")]+)\1\)/gi,
          (match, q, src) => { const uri = resolveUri(src); return uri ? `url('${uri}')` : match; }
        );
      }

      inspectorDrawer.importRawHtml(htmlContent);
      zipSuccess.value = 'ZIP importado exitosamente';
      setTimeout(handleCancel, 1500);

    } else {
      // Production: backend processes + uploads images to CDN
      await inspectorDrawer.sendZip(file);
      zipSuccess.value = 'Plantilla importada exitosamente';
      setTimeout(handleCancel, 1500);
    }

  } catch (err) {
    console.error('❌ Error processing ZIP:', err);
    zipError.value = 'Error al procesar el archivo ZIP';
  } finally {
    zipProcessing.value = false;
  }
}

/* async function handleZipUpload(event: Event) {    
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
} */

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