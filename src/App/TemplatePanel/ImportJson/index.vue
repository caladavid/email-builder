<template>  
  <UModal v-model:open="open" title="Importar plantilla" :ui="{ close: 'cursor-pointer' }">  
    <UTooltip text="Importar plantilla">  
      <UButton  
        variant="ghost"  
        color="neutral"  
        icon="material-symbols:upload"  
        class="cursor-pointer"  
      />  
    </UTooltip>  
  
    <template #body>  
      <div class="space-y-4">  
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
      <div class="flex justify-end w-full gap-2">  
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

<!-- <template>
  <UModal v-model:open="open" title="Import JSON" :ui="{ close: 'cursor-pointer' }">
    <UTooltip text="Import JSON">
      <UButton
        variant="ghost"
        color="neutral"
        icon="material-symbols:upload"
        class="cursor-pointer"
      />
    </UTooltip>

    <template #body>
      <div class="space-y-4">
        <p>
          Copy and paste an EmailBuilder.js JSON (<a
            href="https://gist.githubusercontent.com/jordanisip/efb61f56ba71bd36d3a9440122cb7f50/raw/30ea74a6ac7e52ebdc309bce07b71a9286ce2526/emailBuilderTemplate.json"
            target="_blank"
            class="text-blue-500 hover:underline"
          >example</a>).
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
            @update:model-value="handleChange"
          />
        </form>

        <p class="text-xs mt-2"> This will override your current template. </p>

      </div>
    </template>

    <template #footer>
      <div class="flex justify-end w-full gap-2">
        <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" class="cursor-pointer" />
        <UButton label="Import" @click="handleSubmit" :disabled="error !== null" class="cursor-pointer" />
      </div>
    </template>
  </UModal>
</template> -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
import validateJsonStringValue from './validateJsonStringValue';
import JSZip from 'jszip';  
import { HTMLToBlockParser } from './htmlParser'; 

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

/* function handleSubmit() {
  const { error: err, data } = validateJsonStringValue(value.value)
  error.value = err ?? null

  if (!data) return

  inspectorDrawer.resetDocument(data)
  open.value = false
} */

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
  console.log('=== INICIO handleZipUpload ===');    
  const file = (event.target as HTMLInputElement).files?.[0];  
  if (!file) return;  
  
  console.log('Archivo:', file.name, 'Tamaño:', file.size);    
  
  zipProcessing.value = true;  
  zipError.value = null;  
  zipSuccess.value = null;  
  
  try {  
      console.log('Cargando ZIP...');    
      const zip = new JSZip()  
      const zipContent = await zip.loadAsync(file);  
      console.log('ZIP cargado exitosamente');    
  
      // Buscar index.html recursivamente en todas las carpetas  
      let htmlFile: JSZip.JSZipObject | null = null;  
      let htmlPath = "";  
  
      // Iterar sobre todos los archivos en el ZIP  
      zipContent.forEach((relativePath, file) => {  
        console.log('Archivo encontrado:', relativePath); // Debug: ver todos los archivos  
        if (file.name.toLowerCase().endsWith('index.html') && !file.dir) {  
          if (relativePath.toLowerCase().includes('index.html') || !htmlFile) {  
            htmlFile = file;  
            htmlPath = relativePath;  
            console.log('index.html encontrado en:', relativePath);  
        }  
        }  
      });  
  
      if (!htmlFile) {  
        console.log('No se encontró index.html en ninguna carpeta');    
        zipError.value = 'No se encontró index.html en el archivo ZIP'    
        return    
      }  
  
      console.log('index.html encontrado en:', htmlPath);    
      const htmlContent = await htmlFile.async('string');  
      console.log('Contenido HTML:', htmlContent.substring(0, 100) + '...');   
  
      // Procesar imágenes del ZIP (buscar en la misma carpeta que el HTML)  
      const htmlDirectory = htmlPath.substring(0, htmlPath.lastIndexOf('/') + 1);  
      const imageFiles: { [key: string]: string } = {};  
      const imagePromises: Promise<void>[] = [];  
  
      zipContent.forEach((relativePath, file) => {  
        // Buscar imágenes en la misma carpeta que el HTML o en subcarpetas  
        if (relativePath.startsWith(htmlDirectory) &&   
            (relativePath.includes('images/') || isImageFile(relativePath)) &&   
            !file.dir) {  
          console.log('Imagen encontrada:', relativePath);  
          const promise = file.async('base64').then(base64 => {  
            const extension = relativePath.split('.').pop()?.toLowerCase();  
            const mimeType = getMimeType(extension || "");  
            const fileName = relativePath.split('/').pop() || relativePath;  
            imageFiles[fileName] = `data:${mimeType};base64,${base64}`;  
          });  
          imagePromises.push(promise);  
        }  
      });  
  
      await Promise.all(imagePromises);  
      console.log('Imágenes procesadas:', Object.keys(imageFiles));  
  
      console.log('Creando parser...');  
      const parser = new HTMLToBlockParser()  
  
      console.log('Procesando ZIP...');    
      const editorConfiguration = await parser.parseZipToBlocks(file);  
      console.log('Configuración generada:', editorConfiguration);    
  
      inspectorDrawer.resetDocument(editorConfiguration)  
      zipSuccess.value = 'ZIP importado exitosamente';  
  
      setTimeout(() => {    
        handleCancel();    
      }, 1500);   
  
  } catch (error) {  
    console.error('Error processing ZIP:', error);    
    zipError.value = 'Error al procesar el archivo ZIP';    
  } finally {  
    zipProcessing.value = false;  
  }  
}  */ 

/* async function handleZipUpload(event: Event) {
  console.log('=== INICIO handleZipUpload ===');  
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  console.log('Archivo:', file.name, 'Tamaño:', file.size);  

  zipProcessing.value = true;
  zipError.value = null;
  zipSuccess.value = null;

  try {
      console.log('Cargando ZIP...');  
      const zip = new JSZip()
      const zipContent = await zip.loadAsync(file);
      console.log('ZIP cargado exitosamente');  

      // Buscar archivo index.html en el ZIP  
      const htmlFile = zipContent.file('index.html');
      if (!htmlFile) {
        console.log('No se encontró index.html');  
        zipError.value = 'No se encontró index.html en el archivo ZIP'  
        return  
      }

      console.log('index.html encontrado');  
      const htmlContent = await htmlFile.async('string');
      console.log('Contenido HTML:', htmlContent.substring(0, 100) + '...'); 

      // Procesar imágenes del ZIP  
      const imageFiles: { [key: string]: string } = {};
      const imagePromises: Promise<void>[] = [];

      zipContent.forEach((relativePath, file) => {
        if (relativePath.startsWith('images/') && !file.dir) {
          const promise = file.async('base64').then(base64 => {
            const extension = relativePath.split('.').pop()?.toLowerCase();
            const mimeType = getMimeType(extension || "");
            imageFiles[relativePath] = `data:${mimeType};base64,${base64}`;
          });
          imagePromises.push(promise);
        }
      });

      await Promise.all(imagePromises);

      console.log('Creando parser...');
      const parser = new HTMLToBlockParser()

      console.log('Procesando ZIP...');  
      // Convertir HTML a bloques del email builder  
      const editorConfiguration = await parser.parseZipToBlocks(file);
      console.log('Configuración generada:', editorConfiguration);  

      // Importar la configuración  
      inspectorDrawer.resetDocument(editorConfiguration)

      zipSuccess.value = 'ZIP importado exitosamente';

      // Cerrar modal después de un breve delay  
    setTimeout(() => {  
      handleCancel();  
    }, 1500); 

  } catch (error) {
    console.error('Error processing ZIP:', error);  
    zipError.value = 'Error al procesar el archivo ZIP';  
  } finally {
    zipProcessing.value = false;
  }
} */

async function handleZipUpload(event: Event) {  
  const file = (event.target as HTMLInputElement).files?.[0];  
  if (!file) return;  
  
  zipProcessing.value = true;  
  zipError.value = null;  
  zipSuccess.value = null;  
  
  try {  
    console.log('🔄 Iniciando procesamiento ZIP...');  
      
    // OPCIÓN 1: Dejar que HTMLToBlockParser maneje todo  
    const parser = new HTMLToBlockParser();  
    const editorConfiguration = await parser.parseZipToBlocks(file);  
      
    console.log('✅ Configuración generada:', editorConfiguration);  
      
    // Importar directamente  
    inspectorDrawer.resetDocument(editorConfiguration);  
      
    zipSuccess.value = 'ZIP importado exitosamente';  
      
    setTimeout(() => {  
      handleCancel();  
    }, 1500);  
  
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
