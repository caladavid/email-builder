<template>
  <BaseSidebarPanel title="Bloque de texto">
    <UFormField label="Texto">
      <RichTextEditor  
        label=""  
        :rows="5"  
        :model-value="data.props?.text ?? ''" 
        @update:model-value="handleTextUpdate"  
        @update:formats="handleFormatsUpdate" 
        @text-selected="selectedText = $event"
        placeholder="Escribe tu texto aquí. Usa Ctrl+Space para insertar variables"  
      />  
    </UFormField>

<!--     <div class="mt-3">
      <UButton
        size="sm"
        icon="material-symbols:variable-insert"
        @click=""
      >
        Colocar Variables
      </UButton>
    </div> -->

    <!-- <BooleanInput
      label="Formato Markdown"
      :model-value="Boolean(data.props?.markdown)"
      @update:model-value="handleUpdateData({ ...data, props: { ...data.props, markdown: $event } })"
    /> -->

    <div class="mt-3">
      <UButton
        size="sm"
        icon="material-symbols:add-link"
        @click="toggleLinkPanel"
      >
        Agregar Link
      </UButton>
    </div>

    <!-- Nueva sección de enlaces -->  
    <div v-if="showLinkPanel" class="mt-4 p-3 border border-gray-200 rounded-lg ">  
      <h4 class="text-sm font-medium mb-3">Opciones de Link</h4>  
        
      <UFormField label="Texto seleccionado">  
        <UInput  
          v-model="selectedText"  
          placeholder="Texto a convertir en enlace"  
          class="w-full"  
        />  
      </UFormField>  
        
      <UFormField label="URL">  
        <UInput  
          v-model="linkUrl"  
          placeholder="https://ejemplo.com"  
          class="w-full"  
        />  
      </UFormField>  
        
      <UButton   
        @click="insertLinkAsMarkdown"  
        :disabled="!selectedText || !linkUrl"  
        size="sm"  
        class="mt-2"  
      >  
        Insertar Link  
      </UButton>  
    </div>  

    <MultiStylePropertyPanel
      :names="['color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight', 'textAlign', 'padding']"
      :model-value="data.style"
      @update:model-value="handleUpdateData({ ...data, style: $event })"
    />
  </BaseSidebarPanel>
</template>

<script setup lang="ts">
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';
import type { TextProps } from '@flyhub/email-block-text';
import { TextPropsSchema } from '@flyhub/email-block-text';
import { ref, watch } from 'vue';
import { useInspectorDrawer } from '../../../../documents/editor/editor.store';
import RichTextEditor from '../input-panels/RichTextEditor.vue';

type TextSidebarPanelProps = {
  data: TextProps
}

const props = defineProps<TextSidebarPanelProps>()

const emit = defineEmits<{
  (e: 'update:data', args: TextProps): void
}>()

/** Refs */

const errors = ref<Zod.ZodError | null>(null)
const variables = ref<Record<string, string>>({});
const fileInput = ref<HTMLInputElement | null>(null);
const showLinkPanel = ref(false);
const inspectorDrawer = useInspectorDrawer();

/** Computed */ 

/** Functions */

function handleUpdateData(data: unknown) {
  const res = TextPropsSchema.safeParse(data);

  if (res.success) {

    const updatedData = {
      ...res.data,
      props: {
        ...res.data.props,
        variables: variables.value
      }
    };


    emit('update:data', updatedData);
    /* emit('update:data', res.data); */
    errors.value = null;
  } else {
    errors.value = res.error;
  }
}

function toggleLinkPanel() {
  showLinkPanel.value = !showLinkPanel.value
  // Prefill el texto seleccionado si está vacío
  if (showLinkPanel.value && !selectedText.value) {
    // no-op: ya llega por @text-selected; aquí podrías forzar lectura si hiciera falta
  }
}


function handleTextUpdate(newText: string) {  
   console.log('📝 handleTextUpdate called with:', newText);
  handleUpdateData({   
    ...props.data,   
    props: {   
      ...props.data.props,   
      text: newText   
    }   
  });  
}  
  
function handleFormatsUpdate(newFormats: any[]) {  
console.log('🎨 handleFormatsUpdate called with:', newFormats);

  handleUpdateData({   
    ...props.data,   
    props: {   
      ...props.data.props,   
      formats: newFormats   
    }   
  });  
}

  
// Refs para la funcionalidad de enlaces  
const selectedText = ref('')  
const linkUrl = ref('')  
 
// Función para insertar enlaces  
function insertLinkAsMarkdown() {
  const sel = selectedText.value?.trim()
  const url = linkUrl.value?.trim()
  if (!sel || !url) return

  const currentText = props.data.props?.text ?? ''

  // Reemplazar SOLO la primera ocurrencia del texto seleccionado
  const idx = currentText.indexOf(sel)
  const md = `[${escapeMdText(sel)}](${url})`
  const newText = idx >= 0
    ? currentText.slice(0, idx) + md + currentText.slice(idx + sel.length)
    : (currentText ? currentText + ' ' + md : md)

  handleUpdateData({
    ...props.data,
    style: { ...props.data.style },
    props: {
      ...props.data.props,
      text: newText,
      markdown: true   // ← activar markdown automáticamente
    }
  })

  // Reset UI
  showLinkPanel.value = false
  linkUrl.value = ''
}

function escapeMdText(s: string) {
  return s.replace(/([\[\]\(\)\\])/g, '\\$1')
}

watch(() => (props.data.props as any)?.variables, (newVariables) => {  
  if (newVariables && typeof newVariables === 'object') {  
    variables.value = { ...newVariables }  
  }  
}, { immediate: true }) 

</script>