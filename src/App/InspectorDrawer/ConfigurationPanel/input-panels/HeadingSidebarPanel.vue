<template>
  <BaseSidebarPanel title="Bloque de encabezado">
    <UFormField label="Content">
      <!-- <UTextarea
        :rows="3"
        :model-value="data.props?.text ?? HeadingPropsDefaults.text"
        @update:model-value="handleUpdateData({ ...data, props: { ...data.props, text: $event as string } })"
        class="w-full"
      /> -->
      <RichTextEditor    
        label=""    
        :rows="3"    
        :model-value="data.props?.text ?? HeadingPropsDefaults.text" 
        @update:model-value="handleTextUpdate"  
        @update:formats="handleFormatsUpdate"   
        placeholder="Texto del botón. Usa Ctrl+Space para insertar variables"    
      />  
<!--       <RichTextEditor    
        label=""    
        :rows="3"    
        :model-value="data.props?.text ?? HeadingPropsDefaults.text"    
        @update:model-value="handleUpdateData({ ...data, props: { ...data.props, text: $event as string } })"    
        placeholder="Texto del botón. Usa Ctrl+Space para insertar variables"    
      />  --> 
    </UFormField>
    <RadioGroupInput
      label="Level"
      :model-value="data.props?.level ?? HeadingPropsDefaults.level"
      :items="[{ label: 'H1', value: 'h1' }, { label: 'H2', value: 'h2' }, { label: 'H3', value: 'h3' }]"
      @update:model-value="handleUpdateData({ ...data, props: { ...data.props, level: $event } })"
    />
    <MultiStylePropertyPanel
      :names="['color', 'backgroundColor', 'fontFamily', 'fontWeight', 'textAlign', 'padding']"
      :model-value="data.style"
      @update:model-value="handleUpdateData({ ...data, style: $event })"
    />
  </BaseSidebarPanel>
</template>

<script setup lang="ts">
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';
import RadioGroupInput from './helpers/inputs/RadioGroupInput.vue';
import type { HeadingProps} from '@flyhub/email-block-heading';
import { HeadingPropsSchema, HeadingPropsDefaults } from '@flyhub/email-block-heading';
import { ref } from 'vue';
import RichTextEditor from './RichTextEditor.vue';

type HeadingSidebarPanelProps = {
  data: HeadingProps
}

const props = defineProps<HeadingSidebarPanelProps>()

const emit = defineEmits<{
  (e: 'update:data', args: HeadingProps): void
}>()

/** Refs */

const errors = ref<Zod.ZodError | null>(null)

/** Functions */


function handleUpdateData(data: unknown) {
  const res = HeadingPropsSchema.safeParse(data);

  if (res.success) {
    emit('update:data', res.data);
    errors.value = null;
  } else {
    errors.value = res.error;
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
  console.log('🟢 Panel - handleFormatsUpdate:', {  
    newFormats,  
    formatsLength: newFormats.length,  
    currentBlockId: props.data  
  }); 

  handleUpdateData({   
    ...props.data,   
    props: {   
      ...props.data.props,   
      formats: newFormats   
    }   
  });  
}
</script>
