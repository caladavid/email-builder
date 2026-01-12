<template>
  <template v-for="(name) in names" :key="name">
    <SingleStylePropertyPanel 
      :name="name" 
      :model-value="normalizedModelValue" 
      @update:model-value="handleUpdate" 
    />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TStyle } from '../../../../../../documents/blocks/helpers/TStyle';
import SingleStylePropertyPanel from './SingleStylePropertyPanel.vue';

type MultiStylePropertyPanelProps = {
  names: (keyof TStyle)[],
  modelValue: TStyle | undefined | null,
}

const props = defineProps<MultiStylePropertyPanelProps>()

const emit = defineEmits<{
  (e: 'update:model-value', args: TStyle): void
}>()

const normalizedModelValue = computed(() => {  
  if (!props.modelValue) return {};  
    
  const normalized = { ...props.modelValue };  
    
  // Normalizar padding si existe  
  if (normalized.padding && typeof normalized.padding === 'object') {  
    normalized.padding = {  
      top: Array.isArray(normalized.padding.top) ?   
        parseInt(String(normalized.padding.top[0] || 0)) || 0 :   
        parseInt(String(normalized.padding.top || 0)) || 0,  
      right: Array.isArray(normalized.padding.right) ?   
        parseInt(String(normalized.padding.right[0] || 0)) || 0 :   
        parseInt(String(normalized.padding.right || 0)) || 0,  
      bottom: Array.isArray(normalized.padding.bottom) ?   
        parseInt(String(normalized.padding.bottom[0] || 0)) || 0 :   
        parseInt(String(normalized.padding.bottom || 0)) || 0,  
      left: Array.isArray(normalized.padding.left) ?   
        parseInt(String(normalized.padding.left[0] || 0)) || 0 :   
        parseInt(String(normalized.padding.left || 0)) || 0,  
    };  
  }  
    
  return normalized;  
});  
  
// 🔥 FIX: Normalizar padding al emitir  
function handleUpdate(newStyle: TStyle) {  
  const normalized = { ...newStyle };  
    
  // Asegurar que padding sea siempre numérico  
  if (normalized.padding && typeof normalized.padding === 'object') {  
    Object.keys(normalized.padding).forEach(key => {  
      const value = normalized.padding[key];  
      if (Array.isArray(value)) {  
        normalized.padding[key] = parseInt(String(value[0] || 0)) || 0;  
      } else {  
        normalized.padding[key] = parseInt(String(value || 0)) || 0;  
      }  
    });  
  }  
    
  emit('update:model-value', normalized);  
}  
</script>