<template>  
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-2xl' }">  
    <UCard>  
      <template #header>  
        <h3 class="text-lg font-semibold">Import JSON</h3>  
      </template>  
  
      <form @submit.prevent="handleSubmit">  
        <div class="space-y-4">  
          <p class="text-sm text-gray-500">  
            Copy and paste an EmailBuilder.js JSON (  
            <ULink  
              to="https://gist.githubusercontent.com/jordanisip/efb61f56ba71bd36d3a9440122cb7f50/raw/30ea74a6ac7e52ebdc309bce07b71a9286ce2526/emailBuilderTemplate.json"  
              target="_blank"  
              active-class="text-primary"  
              inactive-class="text-primary hover:text-primary-600"  
            >  
              example  
            </ULink>  
            ).  
          </p>  
  
          <UAlert  
            v-if="error"  
            color="red"  
            variant="soft"  
            :title="error"  
          />  
  
          <UTextarea  
            v-model="value"  
            :rows="10"  
            :error="error !== null"  
            placeholder="Paste your JSON here..."  
            @input="handleChange"  
          />  
  
          <p class="text-xs text-gray-500">  
            This will override your current template.  
          </p>  
        </div>  
  
        <template #footer>  
          <div class="flex justify-end gap-2">  
            <UButton  
              color="gray"  
              variant="ghost"  
              @click="handleClose"  
            >  
              Cancel  
            </UButton>  
            <UButton  
              type="submit"  
              :disabled="error !== null"  
            >  
              Import  
            </UButton>  
          </div>  
        </template>  
      </form>  
    </UCard>  
  </UModal>  
</template>  
  
<script setup lang="ts">  
import { computed, ref } from 'vue';  
 
import validateJsonStringValue from './validateJsonStringValue';  
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
  
const props = defineProps<{  
  modelValue: boolean;  
}>();  
  
const emit = defineEmits<{  
  'update:modelValue': [value: boolean];  
}>();  
  
const editorStore = useInspectorDrawer();  
  
const isOpen = computed({  
  get: () => props.modelValue,  
  set: (value) => emit('update:modelValue', value)  
});  
  
const value = ref('');  
const error = ref<string | null>(null);  
  
function handleChange() {  
  const { error: validationError } = validateJsonStringValue(value.value);  
  error.value = validationError ?? null;  
}  
  
function handleSubmit() {  
  const { error: validationError, data } = validateJsonStringValue(value.value);  
  error.value = validationError ?? null;  
    
  if (!data) {  
    return;  
  }  
    
  editorStore.resetDocument(data);  
  handleClose();  
}  
  
function handleClose() {  
  isOpen.value = false;  
  value.value = '';  
  error.value = null;  
}  
</script>