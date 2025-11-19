<template>
  <div class="relative">
    <UFormField :label="label">
      <div class="absolute right-0 -top-8 w-fit flex border-2 border-[var(--ui-bg)] bg-[var(--ui-bg)] rounded-tl-lg rounded-tr-lg">

        <UPopover v-model:open="showVariablesDropdown">
          <UTooltip 
            text="Insertar variable" 
            arrow 
            :delay-duration="0" 
            :content="{ side: 'top', align: 'center' }"
          >
            <UButton
              icon="material-symbols:variable-insert"
              variant="ghost"
              size="sm"
              class=" right-2 -top-6"
              @click="toggleVariablesDropdown"
            />
          </UTooltip>
          
          
          <template #content>
            <div class="max-h-64 overflow-y-auto p-2">
              <div 
                v-for="(item, index) in variableItems" 
                :key="index" 
                @click="insertVariable(item.key)" 
                class="flex items-center gap-2 p-2 hover:bg-[var(--ui-primary)] hover:text-[var(--ui-text)] cursor-pointer rounded"
              >
                <span>{{ item.value }}</span>
              </div>
              <div v-if="Object.keys(variableItems).length === 0" class="px-3 py-2 text-gray-500">  
                No hay variables disponibles  
              </div>  
            </div>
          </template>
        </UPopover>
        
          <UTooltip 
            text="Colocar negritas" 
            arrow 
            :delay-duration="0" 
            :content="{ side: 'top', align: 'center' }"
          >
            <UButton
              icon="material-symbols:format-bold"
              variant="ghost"
              size="sm"
              class=" right-10 -top-6"
              @click="applyBold"
            />
          </UTooltip>
        
          <UTooltip 
            text="Colocar italic" 
            arrow 
            :delay-duration="0" 
            :content="{ side: 'top', align: 'center' }"
          >
            <UButton
              icon="material-symbols:format-italic"
              variant="ghost"
              size="sm"
              class=" right-18 -top-6"
              @click="applyItalic"
            />
          </UTooltip>


      </div>
    </UFormField>
  </div>
</template>
              <!-- <span class="font-mono text-sm" v-text="'{{' + item.key + '}}'"></span> -->

<script setup lang="ts">
import { computed, nextTick, ref, onMounted, watch } from "vue";
import { useInspectorDrawer } from "../../../../documents/editor/editor.store";

type Props = {
  label: string;
  modelValue: string;
  rows?: number;
  placeholder?: string;
  editableElement: HTMLElement | null;
};

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:model-value", value: string): void;
  (e: "text-selected", selectedText: string): void;
  (e: "content-changed"): void;
}>();

const inspectorDrawer = useInspectorDrawer();
const textareaRef = ref<any>(null);
const showVariablesDropdown = ref(false);
const isInternalUpdate = ref(false);  
const cursorPosition = ref(0);
const editableDiv = ref<HTMLDivElement | null>(null);
const dropdownPosition = ref({ top: "0px", left: "0px" });
const selectedText = ref('');  
const lastCursorPosition = ref(0); // NUEVO: Para guardar posición del cursor

let savedTextareaElement: HTMLTextAreaElement | null = null;

onMounted(() => {
  if (textareaRef.value) {
    savedTextareaElement = textareaRef.value?.$el.querySelector("textarea") || null;
    console.log("onMounted: Native textarea element saved.");
  }
});

const variableItems = computed(() => {
  return Object.entries(inspectorDrawer.globalVariables || {}).map(
    ([key, value]) => ({
      key,
      value,
      label: `${value}`,
    })
  );
});

// NUEVAS FUNCIONES: Guardar y restaurar posición del cursor
function saveCursorPosition() {
  const element = props.editableElement;
  if (!element) {
    console.error("No editable element provided for saveCursorPosition");
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  lastCursorPosition.value = preCaretRange.toString().length;
  
  console.log('💾 InlineTextToolbar - saveCursorPosition:', lastCursorPosition.value);
}

function restoreCursorPosition() {
  const element = props.editableElement;
  if (!element) {
    console.error("No editable element provided for restoreCursorPosition");
    return;
  }

  const selection = window.getSelection();
  if (!selection) return;

  console.log('🔄 InlineTextToolbar - restoreCursorPosition: restoring to', lastCursorPosition.value);

  let charIndex = 0;
  const nodeStack = [element];
  let node: Node | null = null;
  let found = false;

  while (!found && (node = nodeStack.pop()!)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nextCharIndex = charIndex + (node.textContent?.length || 0);
      if (lastCursorPosition.value >= charIndex && lastCursorPosition.value <= nextCharIndex) {
        const range = document.createRange();
        range.setStart(node, lastCursorPosition.value - charIndex);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        found = true;
        console.log('✅ InlineTextToolbar - Position restored to text node with offset', lastCursorPosition.value - charIndex);
      }
      charIndex = nextCharIndex;
    } else {
      const children = node.childNodes;
      for (let i = children.length - 1; i >= 0; i--) {
        nodeStack.push(children[i]);
      }
    }
  }

  if (!found) {
    console.warn('⚠️ InlineTextToolbar - Position not found, moving to end');
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// FUNCIÓN CORREGIDA: Insertar variable
function insertVariable(variableKey: string) {  
  console.log('🔧 InlineTextToolbar - insertVariable called with:', variableKey);
  
  const element = props.editableElement;  
  if (!element) {
    console.error("InlineTextToolbar: editableElement es null");
    return;  
  }  

  element.focus();  

  const variableText = `{${variableKey}}`;
  let selection = window.getSelection();
  let range: Range | null = null;

  if (selection && selection.rangeCount > 0) {
    range = selection.getRangeAt(0);
    // Si la selección no está dentro del editable, la mandamos al final
    if (!element.contains(range.commonAncestorContainer)) {
      range = null;
    }
  }

  if (!range) {
    // Crear rango al final del contenido
    range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  // Intentar con execCommand primero
  let inserted = false;
  try {
    inserted = document.execCommand('insertText', false, variableText);
  } catch (e) {
    console.warn('InlineTextToolbar: execCommand insertText falló, usando fallback', e);
  }

  if (!inserted && range) {
    // Fallback manual
    range.deleteContents();
    const textNode = document.createTextNode(variableText);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  // Notificar al padre para que procese el DOM
  emit('content-changed');

  showVariablesDropdown.value = false;
}

// FUNCIONES ACTUALIZADAS: applyBold y applyItalic
function applyBold(){
  console.log('🔧 InlineTextToolbar - applyBold called');
  
  const element = props.editableElement;
  if (!element){
    console.error("No se ha proporcionado un elemento editable (editableElement).");
    return;
  };

  // 1. Guardar posición actual
  /* saveCursorPosition(); */

  // 2. Enfocar y restaurar posición
  element.focus();
 /*  restoreCursorPosition(); */

  // 3. Aplicar formato
  document.execCommand('bold', false, undefined);

  // 4. Volver a guardar la posición después del cambio
  /* saveCursorPosition(); */

  // 5. Notificar al padre
  emit('content-changed');

}

function applyItalic(){
  console.log('🔧 InlineTextToolbar - applyItalic called');
  
  const element = props.editableElement;
  if (!element){
    console.error("No se ha proporcionado un elemento editable (editableElement).");
    return;
  };

  // 1. Guardar posición actual
  /* saveCursorPosition(); */

  // 2. Enfocar y restaurar posición
  element.focus();
  /* restoreCursorPosition(); */

  // 3. Aplicar formato
  document.execCommand('italic', false, undefined);

  // 4. Volver a guardar la posición después del cambio
  /* saveCursorPosition(); */

  // 5. Notificar al padre
  emit('content-changed');
  
  console.log('✅ InlineTextToolbar - applyItalic completed');
}

// ACTUALIZAR handleKeydown para guardar posición
function handleKeydown(event: KeyboardEvent) {
  // Mostrar el dropdown de variables con Ctrl + Space o @
  if ((event.ctrlKey && event.code === "Space") || event.key === "@") {
    event.preventDefault();
    console.log('⌨️ InlineTextToolbar - Ctrl+Space pressed, saving cursor position');
    saveCursorPosition(); // GUARDAR POSICIÓN AL ABRIR DROPDOWN
    showVariablesDropdown.value = true;
  }

  if (event.key === "Escape") {
    showVariablesDropdown.value = false;
  }

  if((event.ctrlKey && event.key === "b")){
    event.preventDefault(); 
    console.log("Bold toggled!")
    applyBold();
  }

  if((event.ctrlKey && event.key === "i")){
    event.preventDefault(); 
    applyItalic();
  }
  
  // Guardar posición en teclas importantes
  if (event.key === 'Enter' || event.key === 'Backspace' || event.key === 'Delete') {
    setTimeout(() => {
      console.log('💾 InlineTextToolbar - Auto-saving cursor position after keypress');
      saveCursorPosition();
    }, 10);
  }
}

// ACTUALIZAR toggleVariablesDropdown para guardar posición
function toggleVariablesDropdown() {
  console.log('📋 InlineTextToolbar - toggleVariablesDropdown, saving cursor position');
  saveCursorPosition(); // GUARDAR POSICIÓN AL ABRIR DROPDOWN
  showVariablesDropdown.value = !showVariablesDropdown.value;
}

// Resto de funciones existentes (sin cambios)...
function handleTextChange(value: string) {
  emit("update:model-value", value);
}

function updateCursorPosition() {
  if (savedTextareaElement) {
    cursorPosition.value = savedTextareaElement.selectionStart || 0;
  }
}

function handleTextSelection() {  
  if (!savedTextareaElement) return;  
    
  const start = savedTextareaElement.selectionStart || 0;  
  const end = savedTextareaElement.selectionEnd || 0;  
    
  if (start !== end) {  
    const selection = props.modelValue.substring(start, end);  
    selectedText.value = selection;  
    emit('text-selected', selection);  
  }  
}  

function getCurrentSelection(): string {  
  if (!savedTextareaElement) return '';  
    
  const start = savedTextareaElement.selectionStart || 0;  
  const end = savedTextareaElement.selectionEnd || 0;  
    
  return start !== end ? props.modelValue.substring(start, end) : '';  
}

async function updateDropdownPosition() {
  await nextTick();
  if (!savedTextareaElement) return;

  const rect = savedTextareaElement.getBoundingClientRect();
  const lineHeight = 20;
  const textBeforeCursor = props.modelValue.substring(0, cursorPosition.value);
  const lines = textBeforeCursor.split("\n").length;

  dropdownPosition.value = {
    top: `${rect.top + lines * lineHeight + 30}px`,
    left: `${rect.left + 10}px`,
  };
}

function focusEditableElementAndToggleDropdown() {
  if (props.editableElement) {
    props.editableElement.focus();
  }
  showVariablesDropdown.value = !showVariablesDropdown.value;
}

// Watcher de debug
watch(lastCursorPosition, (newPos) => {
  console.log('📍 InlineTextToolbar - lastCursorPosition changed to:', newPos);
});

watch(showVariablesDropdown, (isOpen) => {
  console.log('📋 InlineTextToolbar - Variables dropdown:', isOpen ? 'OPEN' : 'CLOSED');
});

defineExpose({  
  getCurrentSelection,  
  getSelectedText: () => selectedText.value,
  applyBold,  
  applyItalic, 
  handleKeydown,
  saveCursorPosition, // EXPORTAR para que el padre pueda llamarlo
  restoreCursorPosition // EXPORTAR para que el padre pueda llamarlo
});
</script>