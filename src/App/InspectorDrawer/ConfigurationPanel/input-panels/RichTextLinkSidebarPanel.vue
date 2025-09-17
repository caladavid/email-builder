<template>  
  <BaseSidebarPanel title="Rich Text Link block">  
    <UFormField label="Content">  
      <div class="content-preview" v-html="data.props?.content ?? 'No content'" />  
    </UFormField>  
  
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
import type { RichTextLinkProps } from '../../../../documents/blocks/RichTextLink/RichTextLinkPropsSchema';  
import RichTextLinkPropsSchema from '../../../../documents/blocks/RichTextLink/RichTextLinkPropsSchema';  
import { ref } from 'vue';  
  
type RichTextLinkSidebarPanelProps = {  
  data: RichTextLinkProps;  
}  
  
const props = defineProps<RichTextLinkSidebarPanelProps>();  
  
const emit = defineEmits<{  
  (e: 'update:data', args: RichTextLinkProps): void  
}>();  
  
const errors = ref<Zod.ZodError | null>(null);  
  
function handleUpdateData(data: unknown) {  
  const res = RichTextLinkPropsSchema.safeParse(data);  
    
  if (res.success) {  
    emit('update:data', res.data);  
    errors.value = null;  
  } else {  
    errors.value = res.error;  
  }  
}  
</script>  
  
<style scoped>  
.content-preview {  
  padding: 8px;  
  border: 1px solid #e5e7eb;  
  border-radius: 4px;  
  background: #f9fafb;  
  min-height: 40px;  
  font-size: 14px;  
}  
</style>