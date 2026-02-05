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
    </UFormField>
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

const file = ref<File | null>(null);

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

/* function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files
  if (files && files.length > 0) {
    file.value = files[0];

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target?.result as string;


      handleUpdateData({
        ...props.data,
        props: { ...props.data.props, imageUrl: base64Url}
      });
    };

    reader.readAsDataURL(files[0]);
  };
} */

async function onFileChange(event: Event) {  
  const target = event.target as HTMLInputElement;  
  const files = target.files;  
  if (files && files.length > 0) {  
    const file = files[0];  
    // Llama a tu función uploadImage (debe estar expuesta en el store)  
    const imageUrl = await inspectorDrawer.uploadImage(file);  
    if (imageUrl) {  
      handleUpdateData({  
        ...props.data,  
        props: { ...props.data.props, imageUrl: imageUrl }  
      });  
    } else {  
      const reader = new FileReader();  
      reader.onload = (e) => {  
        const base64Url = e.target?.result as string;  
        handleUpdateData({  
          ...props.data,  
          props: { ...props.data.props, imageUrl: base64Url }  
        });  
      };   
      reader.readAsDataURL(file); 
    }  
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
