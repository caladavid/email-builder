<template>
  <div class="rich-text-container">
    <!-- Editor -->
    <div
      ref="richTextEditor"
      class="rich-text-editor"
      contenteditable="true"
      :placeholder="placeholder"
      @input="onInput"
      @mouseup="handleTextSelection"
    />

    <!-- Tooltip para convertir a enlace -->
    <div
      v-if="showLinkTooltip"
      class="link-tooltip"
      :style="tooltipPosition"
    >
      <UButton
        size="xs"
        @click="showLinkDialog = true"
        icon="material-symbols:link"
      >
        Add Link
      </UButton>
    </div>

    <!-- Dialog para agregar enlace -->
    <UModal v-model="showLinkDialog" title="Add Link">
      <template #body>
        <UFormField label="URL">
          <UInput
            v-model="linkUrl"
            placeholder="https://example.com"
          />
        </UFormField>

        <div class="flex gap-2 mt-4">
          <UButton @click="applyLink">Apply</UButton>
          <UButton variant="ghost" @click="showLinkDialog = false">Cancel</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';

type Props = {
  modelValue: string
  placeholder?: string
  rows?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  rows: 5
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>();

// Refs / estado interno
const richTextEditor = ref<HTMLElement>();
const showLinkTooltip = ref(false);
const showLinkDialog = ref(false);
const linkUrl = ref('');
const selectedText = ref('');
const selectionRange = ref<Range | null>(null);
const tooltipPosition = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

// Sincronizar contenido externo → interno
const setEditorHTML = (html: string) => {
  if (!richTextEditor.value) return;
  if (richTextEditor.value.innerHTML !== html) {
    richTextEditor.value.innerHTML = html || '';
  }
};

onMounted(() => {
  setEditorHTML(props.modelValue);
});

watch(
  () => props.modelValue,
  (v) => {
    setEditorHTML(v || '');
  }
);

// Input del editor → emitir al padre
function onInput(e: Event) {
  const el = e.target as HTMLElement;
  emit('update:modelValue', el.innerHTML);
}

// Selección de texto para mostrar tooltip
function handleTextSelection() {
  const sel = window.getSelection();
  if (sel && sel.toString().trim().length > 0) {
    selectedText.value = sel.toString();
    selectionRange.value = sel.getRangeAt(0).cloneRange();

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    tooltipPosition.value = {
      top: `${rect.bottom + 5}px`,
      left: `${rect.left}px`
    };

    showLinkTooltip.value = true;
  } else {
    showLinkTooltip.value = false;
  }
}

// Aplicar <a> al texto seleccionado
function applyLink() {
  if (!selectionRange.value || !linkUrl.value) {
    showLinkDialog.value = false;
    return;
  }

  try {
    const link = document.createElement('a');
    link.href = linkUrl.value;
    link.target = '_blank';
    link.style.color = 'inherit';
    link.style.textDecoration = 'underline';
    link.textContent = selectedText.value;

    // Restaurar selección
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(selectionRange.value);

    selectionRange.value.deleteContents();
    selectionRange.value.insertNode(link);

    // Emitir nuevo HTML
    nextTick(() => {
      if (richTextEditor.value) {
        emit('update:modelValue', richTextEditor.value.innerHTML);
      }
    });
  } catch (err) {
    console.error('Error applying link:', err);
  }

  // Reset estado
  showLinkDialog.value = false;
  showLinkTooltip.value = false;
  linkUrl.value = '';
  selectedText.value = '';
  selectionRange.value = null;
}
</script>

<style scoped>
.rich-text-container {
  position: relative;
}

.rich-text-editor {
  min-height: 120px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
  /* Permite ver el placeholder cuando está vacío */
}

.rich-text-editor:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.link-tooltip {
  position: fixed;
  z-index: 1000;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Opcional: estilo para mostrar placeholder en contenteditable */
.rich-text-editor:empty:before {
  content: attr(placeholder);
  color: #9ca3af;
}
</style>
