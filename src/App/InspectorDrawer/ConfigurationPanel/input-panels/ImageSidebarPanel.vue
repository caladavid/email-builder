<template>
  <BaseSidebarPanel title="Bloque de imagen">
    <UFormField label="URL de origen">
      <UInput
        :model-value="data.props?.url ?? ''"
        @update:model-value="(e) => {
          const event = (e as string).trim();
          const url = event.length === 0 ? null : event;
          handleUpdateData({ ...data, props: { ...data.props, url } })
        }"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Texto alternativo">
      <UInput
        :model-value="data.props?.alt ?? ''"
        @update:model-value="handleUpdateData({ ...data, props: { ...data.props, alt: $event as string } })"
        class="w-full"
      />
    </UFormField>

    <UFormField label="URL de redirección">
      <UInput
        :model-value="data.props?.linkHref ?? ''"
        @update:model-value="(e) => {
          const event = (e as string).trim();
          const linkHref = event.length === 0 ? null : event;
          handleUpdateData({ ...data, props: { ...data.props, linkHref } })
        }"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Subir imagen">
      <UInput
        type="file"
        icon="material-symbols:imagesmode"
        accept="image/*"
        placeholder="Subir imagen"
        @change="onFileChange"
      />
      <p v-if="uploadError" class="text-red-500 text-xs mt-1">{{ uploadError }}</p>
    </UFormField>

    <div
      v-if="showUploadWarning"
      class="flex items-start gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-3 py-2 text-xs text-yellow-800"
    >
      <span class="mt-0.5">⚠️</span>
      <span>Falta token de servicios, la imagen puede no verse en el email.</span>
    </div>

    <div class="flex gap-2">
      <TextDimensionInput
        label="Ancho (Width)"
        :model-value="data.props?.width"
        @change="(e: Event) => {
            // 🔥 CORRECCIÓN: Extraer el valor del input del evento
            const target = e.target as HTMLInputElement;
            const val = target.value; 
            handleUpdateData({ ...data, props: { ...data.props, width: val } })
        }"
      />
      <TextDimensionInput
        label="	Alto (Height)"
        :model-value="data.props?.height"
        @change="(e: Event) => {
            // 🔥 CORRECCIÓN: Lo mismo para la altura
            const target = e.target as HTMLInputElement;
            const val = target.value;
            handleUpdateData({ ...data, props: { ...data.props, height: val } })
        }"
      />
    </div>

    <RadioGroupInput
      label="Alineación"
      :model-value="data.props?.contentAlignment ?? 'middle'"
      :items="[
        { icon: 'material-symbols:vertical-align-top', value: 'top' },
        { icon: 'material-symbols:vertical-align-center', value: 'center' },
        { icon: 'material-symbols:vertical-align-bottom', value: 'bottom' }
      ]"
      @update:model-value="handleUpdateData({ ...data, props: { ...data.props, contentAlignment: $event } })"
    />

    <MultiStylePropertyPanel
      :names="['backgroundColor', 'textAlign', 'padding']"
      :model-value="data.style"
      @update:model-value="handleUpdateData({ ...data, style: $event })"
    />
    
  </BaseSidebarPanel>
</template>

<script setup lang="ts">
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';
import RadioGroupInput from './helpers/inputs/RadioGroupInput.vue';
import TextDimensionInput from './helpers/inputs/TextDimensionInput.vue';
import type { ImageProps } from '../../../../documents/blocks/Image/ImageReader.vue'; 
import { ImagePropsSchema } from '../../../../documents/blocks/Image/ImageReader.vue'; 
import { ref, watch } from 'vue';
import { z } from 'zod';
import { useInspectorDrawer } from '../../../../documents/editor/editor.store';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const file = ref<File | null>(null);
const showUploadWarning = ref(false);
const uploadError = ref<string | null>(null);

type ImageSidebarPanelProps = {
  data: ImageProps
}

const props = defineProps<ImageSidebarPanelProps>()
const inspectorDrawer = useInspectorDrawer()

const emit = defineEmits<{
  (e: 'update:data', args: ImageProps): void
}>()

/** Refs */

const errors = ref<z.ZodError | null>(null)

/** Functions */

function handleUpdateData(data: unknown) {
  const res = ImagePropsSchema.safeParse(data);

  if (res.success) {
    emit('update:data', res.data);
    errors.value = null;
  } else {
    errors.value = res.error;
  }
}

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  const selectedFile = files[0];
  uploadError.value = null;

  if (!ALLOWED_IMAGE_TYPES.includes(selectedFile.type)) {
    uploadError.value = 'Tipo de archivo no permitido. Use JPG, PNG, GIF, WebP o SVG.';
    target.value = '';
    return;
  }
  if (selectedFile.size > MAX_IMAGE_SIZE) {
    uploadError.value = 'El archivo supera el límite de 10MB.';
    target.value = '';
    return;
  }

  const imageUrl = await inspectorDrawer.uploadImage(selectedFile);
  if (imageUrl) {
    handleUpdateData({
      ...props.data,
      props: { ...props.data.props, url: imageUrl }
    });
  } else {
    console.warn('⚠️ uploadImage falló, usando base64 como fallback. La imagen puede no verse en el email enviado.');
    showUploadWarning.value = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target?.result as string;
      handleUpdateData({
        ...props.data,
        props: { ...props.data.props, url: base64Url }
      });
    };
    reader.readAsDataURL(selectedFile);
  }
}

watch(  
  () => props.data.props?.url,  
  async (newUrl) => {  
    if (newUrl && newUrl.startsWith('data:image/')) {  
      const convertedUrl = await inspectorDrawer.convertBase64ToService(newUrl);  
      if (convertedUrl !== newUrl) {  
        // Solo actualizar si cambió (servicio funcionó)  
        handleUpdateData({  
          ...props.data,  
          props: { ...props.data.props, url: convertedUrl }  
        });  
      }  
    }  
  },  
  { immediate: true }  
);
</script>
