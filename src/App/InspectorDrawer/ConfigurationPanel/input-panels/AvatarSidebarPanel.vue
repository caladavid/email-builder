<template>
  <BaseSidebarPanel title="Bloque del Avatar">
    <SliderInput
      label="Tamaño"
      icon-label="material-symbols:aspect-ratio"
      units="px"
      :step="3"
      :min="32"
      :max="256"
      :default-value="size"
      @change="handleUpdateData({ ...data, props: { ...data.props, size: $event } })"
    />
    <RadioGroupInput
      label="Forma"
      :model-value="shape"
      :items="[{ label: 'Círculo', value: 'circle' }, { label: 'Cuadrado', value: 'square' }, { label: 'Redondeado', value: 'rounded' }]"
      @update:model-value="handleUpdateData({ ...data, props: { ...data.props, shape: $event } })"
    />
    <UFormField label="URL de la imagen">
      <UInput
        :model-value="imageUrl"
        @update:model-value="handleUpdateData({ ...data, props: { ...data.props, imageUrl: $event as string } })"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Texto alternativo">
      <UInput
        :model-value="alt"
        @update:model-value="handleUpdateData({ ...data, props: { ...data.props, alt: $event as string } })"
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
    <MultiStylePropertyPanel
      :names="['textAlign', 'padding']"
      :model-value="data.style"
      @update:model-value="handleUpdateData({ ...data, style: $event })"
    />
  </BaseSidebarPanel>
</template>

<script setup lang="ts">
import SliderInput from './helpers/inputs/SliderInput.vue';
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';
import RadioGroupInput from './helpers/inputs/RadioGroupInput.vue';
import type { AvatarProps } from '@flyhub/email-block-avatar';
import { AvatarPropsDefaults, AvatarPropsSchema } from '@flyhub/email-block-avatar';
import { ref, computed } from 'vue';
import { z } from 'zod';
import { watch } from 'vue';
import { useInspectorDrawer } from '../../../../documents/editor/editor.store';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const file = ref<File | null>(null);
const showUploadWarning = ref(false);
const uploadError = ref<string | null>(null);

type AvatarSidebarPanelProps = {
  data: AvatarProps;
}

const props = defineProps<AvatarSidebarPanelProps>()
const inspectorDrawer = useInspectorDrawer()
const emit = defineEmits<{
  (e: 'update:data', args: AvatarProps): void
}>()


/** Refs */

const errors = ref<z.ZodError | null>(null)

/** Computed */

const size = computed(() => props.data.props?.size ?? AvatarPropsDefaults.size)
const imageUrl = computed(() => props.data.props?.imageUrl ?? AvatarPropsDefaults.imageUrl)
const alt = computed(() => props.data.props?.alt ?? AvatarPropsDefaults.alt)
const shape = computed(() => props.data.props?.shape ?? AvatarPropsDefaults.shape)

/** Functions */

function handleUpdateData(data: AvatarProps) {
  const res = AvatarPropsSchema.safeParse(data);

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
      props: { ...props.data.props, imageUrl: imageUrl }
    });
  } else {
    console.warn('⚠️ uploadImage falló, usando base64 como fallback. La imagen puede no verse en el email enviado.');
    showUploadWarning.value = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target?.result as string;
      handleUpdateData({
        ...props.data,
        props: { ...props.data.props, imageUrl: base64Url }
      });
    };
    reader.readAsDataURL(selectedFile);
  }
}

watch(  
  () => props.data.props?.imageUrl,  
  async (newUrl) => {  
    if (newUrl && newUrl.startsWith('data:image/')) {  
      const convertedUrl = await inspectorDrawer.convertBase64ToService(newUrl);  
      if (convertedUrl !== newUrl) {  
        // Solo actualizar si cambió (servicio funcionó)  
        handleUpdateData({  
          ...props.data,  
          props: { ...props.data.props, imageUrl: convertedUrl }  
        });  
      }  
    }  
  },  
  { immediate: true }  
);
</script>
