<template>  
  <div v-if="!useMarkdown" class="rich-text-editor">  
    <div class="toolbar mb-2">  
      <UButtonGroup size="sm">  
        <UButton  
          :color="isSelectionBold ? 'primary' : 'gray'"  
          icon="material-symbols:format-bold"  
          @click="toggleBold"  
        />  
        <UButton  
          :color="isSelectionItalic ? 'primary' : 'gray'"  
          icon="material-symbols:format-italic"  
          @click="toggleItalic"  
        />  
        <UButton  
          color="gray"  
          icon="material-symbols:link"  
          @click="showLinkDialog = true"  
          :disabled="!hasSelection"  
        />  
      </UButtonGroup>  
    </div>  
      
    <div  
      ref="editorRef"  
      class="rich-text-content"  
      contenteditable="true"  
      @input="handleInput"  
      @mouseup="updateSelection"  
      @keyup="updateSelection"  
      v-html="modelValue"  
    />  
      
    <!-- Link Dialog -->  
    <UModal v-model="showLinkDialog">  
      <div class="p-4">  
        <h3 class="text-lg font-semibold mb-4">Add Link</h3>  
        <UFormField label="URL">  
          <UInput v-model="linkUrl" placeholder="https://example.com" />  
        </UFormField>  
        <div class="flex gap-2 mt-4">  
          <UButton @click="insertLink" color="primary">Add Link</UButton>  
          <UButton @click="showLinkDialog = false" color="gray">Cancel</UButton>  
        </div>  
      </div>  
    </UModal>  
  </div>  
</template>  
  
<script setup lang="ts">  
import { ref, computed, nextTick } from 'vue'  
  
type Props = {  
  modelValue: string  
  useMarkdown: boolean  
}  
  
const props = defineProps<Props>()  
  
const emit = defineEmits<{  
  (e: 'update:model-value', value: string): void  
}>()  
  
const editorRef = ref<HTMLElement>()  
const showLinkDialog = ref(false)  
const linkUrl = ref('')  
const hasSelection = ref(false)  
const isSelectionBold = ref(false)  
const isSelectionItalic = ref(false)  
  
function handleInput(event: Event) {  
  const target = event.target as HTMLElement  
  emit('update:model-value', target.innerHTML)  
}  
  
function updateSelection() {  
  const selection = window.getSelection()  
  hasSelection.value = selection && selection.toString().length > 0  
    
  if (hasSelection.value) {  
    isSelectionBold.value = document.queryCommandState('bold')  
    isSelectionItalic.value = document.queryCommandState('italic')  
  }  
}  
  
function toggleBold() {  
  document.execCommand('bold')  
  updateSelection()  
  handleInput({ target: editorRef.value } as Event)  
}  
  
function toggleItalic() {  
  document.execCommand('italic')  
  updateSelection()  
  handleInput({ target: editorRef.value } as Event)  
}  
  
function insertLink() {  
  if (linkUrl.value && hasSelection.value) {  
    document.execCommand('createLink', false, linkUrl.value)  
    showLinkDialog.value = false  
    linkUrl.value = ''  
    handleInput({ target: editorRef.value } as Event)  
  }  
}  
</script>  
  
<style scoped>  
.rich-text-content {  
  min-height: 120px;  
  border: 1px solid #d1d5db;  
  border-radius: 0.375rem;  
  padding: 0.75rem;  
  outline: none;  
}  
  
.rich-text-content:focus {  
  border-color: #3b82f6;  
  box-shadow: 0 0 0 1px #3b82f6;  
}  
</style>