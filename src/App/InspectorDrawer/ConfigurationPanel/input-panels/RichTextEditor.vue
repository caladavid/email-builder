<template>
  <div class="relative">
    <UFormField :label="label">
      <div class="relative">

        <!-- <UTextarea
          ref="textareaRef"
          :rows="rows"
          :model-value="modelValue"
          @update:model-value="handleTextChange"
          @keydown="handleKeydown"
          @click="updateCursorPosition"
          @mouseup="handleTextSelection"  
          @keyup="handleTextSelection" 
          class="w-full"
          :placeholder="placeholder"
        /> -->

        <div  
          ref="editableDiv"  
          contenteditable="true"  
          @input="handleContentChange"  
          @keydown="handleKeydown"  
          @focus="handleFocus"  
          @blur="handleBlur" 
          @click="updateCursorPosition"  
          @mouseup="handleTextSelection"  
          @keyup="handleTextSelection"  
          :data-placeholder="placeholder"  
          class="rich-text-editable"  
          :style="{  
            minHeight: `${(rows || 3) * 24}px`,  
            maxHeight: `${(rows || 3) * 48}px`,  
            overflowY: 'auto'  
          }"  
        /> 

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
              class="absolute right-2 -top-6"
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
              class="absolute right-10 -top-6"
              @click="toggleBold"
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
              class="absolute right-18 -top-6"
              @click="toggleItalic"
            />
          </UTooltip>


      </div>
    </UFormField>
  </div>
</template>

<script setup lang="ts">  
import { computed, nextTick, ref, onMounted, watch, inject } from "vue";  
import { useInspectorDrawer } from "../../../../documents/editor/editor.store";  
  
// ============================================  
// TYPE DEFINITIONS  
// ============================================  
type Props = {  
  label: string;  
  modelValue: string;  
  rows?: number;  
  formats?: any[];
  placeholder?: string;  
};  
  
const props = defineProps<Props>();  
const emit = defineEmits<{  
  (e: "update:model-value", value: string): void;  
  (e: "update:formats", value: any[]): void;
  (e: "text-selected", selectedText: string): void;  
  (e: "update:content", value: { text: string; formats: any[] }): void;
}>();  
  
// ============================================  
// REFS & STATE  
// ============================================  
const inspectorDrawer = useInspectorDrawer();  
  
// Contenteditable refs (currently active)  
const editableDiv = ref<HTMLDivElement | null>(null);  
const isInternalUpdate = ref(false);  
const isActivelyEditing = ref(false);  
  
// Textarea refs (for future use)  
const textareaRef = ref<any>(null);  
let savedTextareaElement: HTMLTextAreaElement | null = null;  
  
// Shared refs  
const showVariablesDropdown = ref(false);  
const cursorPosition = ref(0);  
const lastCursorPosition = ref(0);  
const dropdownPosition = ref({ top: "0px", left: "0px" });  
const selectedText = ref('');  
  
// ============================================  
// COMPUTED PROPERTIES  
// ============================================  
const variableItems = computed(() => {  
  return Object.entries(inspectorDrawer.globalVariables || {}).map(  
    ([key, value]) => ({  
      key,  
      value,  
      label: `${value}`,  
    })  
  );  
});  

const blockProps = computed(() => {
  const blockId = inspectorDrawer.selectedBlockId;
  if (!blockId) return null;
  const block = inspectorDrawer.document[blockId];
  
  return {
    text: block?.data?.props?.text || '',
    formats: block?.data?.props?.formats || []
  };
}); 
  
// ============================================  
// LIFECYCLE HOOKS  
// ============================================  
  
// Textarea initialization (commented for future use)  
/*   
onMounted(() => {  
  if (textareaRef.value) {  
    savedTextareaElement = textareaRef.value?.$el.querySelector("textarea") || null;  
    console.log("onMounted: Native textarea element saved.");  
  }  
});  
*/  
  
// Contenteditable initialization (currently active)  
onMounted(() => {    
  if (!editableDiv.value) return;

  const blockId = inspectorDrawer.selectedBlockId;
  if (!blockId) return;

  const selectedBlock = inspectorDrawer.document[blockId];
  const text = selectedBlock?.data?.props?.text || '';
  const formats = selectedBlock?.data?.props?.formats || [];

  const htmlContent = textWithFormatsToHtml(text, formats);
  editableDiv.value.innerHTML = htmlContent;
}); 
  
// ============================================  
// EVENT HANDLERS - SHARED  
// ============================================  
  
function handleKeydown(event: KeyboardEvent) {  
  // Show variables dropdown with Ctrl + Space or @  
  if ((event.ctrlKey && event.code === "Space") || event.key === "@") {  
    event.preventDefault();  
    saveCursorPosition();
      
      
    showVariablesDropdown.value = true;  
  }  
  
  if (event.key === "Escape") {  
    showVariablesDropdown.value = false;  
  }  
  
  // Bold shortcut (Ctrl+B)  
  if((event.ctrlKey && event.key === "b")){  
    event.preventDefault();   
    toggleBold();  
  }  
  
  // Italic shortcut (Ctrl+I)  
  if((event.ctrlKey && event.key === "i")){  
    event.preventDefault();   
    toggleItalic();  
  }  
}  
 
// ============================================  
// EVENT HANDLERS - CONTENTEDITABLE (Active)  
// ============================================  
  
/* function handleContentChange(event: Event) {    
  if (!editableDiv.value) return;    
    
  isInternalUpdate.value = true;    
    
  const htmlContent = editableDiv.value.innerHTML;    
  const { text, formats } = htmlToTextAndFormats(htmlContent);    
    
  // Emit plain text only  
  emit("update:model-value", text);    
    
  setTimeout(() => {    
    isInternalUpdate.value = false;    
  }, 100);    
}  */ 
  
function updateCursorPosition() {  
  // Contenteditable version (currently active)  
  // No specific action needed for contenteditable  
    
  // Textarea version (commented)  
  /*  
  if (savedTextareaElement) {  
    cursorPosition.value = savedTextareaElement.selectionStart || 0;  
  }  
  */  
}  
  
function handleTextSelection() {  
  // Contenteditable version (currently active)  
  // Selection is handled by browser for contenteditable  
    
  // Textarea version (commented)  
  /*  
  if (!savedTextareaElement) return;    
      
  const start = savedTextareaElement.selectionStart || 0;    
  const end = savedTextareaElement.selectionEnd || 0;    
      
  if (start !== end) {    
    const selection = props.modelValue.substring(start, end);    
    selectedText.value = selection;    
    emit('text-selected', selection);    
  }  
  */  
}  
  
function getCurrentSelection(): string {  
  // Contenteditable version (currently active)  
  const selection = window.getSelection();  
  return selection ? selection.toString() : '';  
    
  // Textarea version (commented)  
  /*  
  if (!savedTextareaElement) return '';    
      
  const start = savedTextareaElement.selectionStart || 0;    
  const end = savedTextareaElement.selectionEnd || 0;    
      
  return start !== end ? props.modelValue.substring(start, end) : '';  
  */  
}  
  
// ============================================  
// FORMAT FUNCTIONS - TEXTAREA (Commented)  
// ============================================  
  
/*  
function toggleBold() {  
  // TEXTAREA VERSION - Manipulates HTML tags in plain text  
  if (!savedTextareaElement) return;  
    
  const start = savedTextareaElement.selectionStart || 0;  
  const end = savedTextareaElement.selectionEnd || 0;  
    
  if (start === end) return;  
  
  const fullText = props.modelValue;  
  const selection = fullText.substring(start, end);  
  const before = fullText.substring(0, start);  
  const after = fullText.substring(end);  
  
  const BOLD_OPEN = "<b>";  
  const BOLD_CLOSE = "</b>";  
  const BOLD_OPEN_LENGTH = BOLD_OPEN.length;  
  const BOLD_CLOSE_LENGTH = BOLD_CLOSE.length;  
  
  const findBoldOpenPosition = (): number => {  
    for (let i = start; i >= 0; i--) {  
      if (fullText.substring(i, i + BOLD_OPEN_LENGTH) === BOLD_OPEN) {  
        return i;  
      }  
    }  
    return -1;  
  };  
  
  const findBoldClosePosition = (): number => {  
    for (let i = end; i <= fullText.length - BOLD_CLOSE_LENGTH; i++) {  
      if (fullText.substring(i, i + BOLD_CLOSE_LENGTH) === BOLD_CLOSE) {  
        return i;  
      }  
    }  
    return -1;  
  };  
  
  const openTagPos = findBoldOpenPosition();  
  const closeTagPos = findBoldClosePosition();  
  
  const isProperlyWrapped =   
    openTagPos !== -1 &&   
    closeTagPos !== -1 &&  
    openTagPos <= start &&  
    closeTagPos >= end &&  
    !selection.includes(BOLD_OPEN) &&   
    !selection.includes(BOLD_CLOSE);  
  
  let newText: string;  
  let newStart: number;  
  let newEnd: number;  
  
  if (isProperlyWrapped) {  
    newText =   
      fullText.substring(0, openTagPos) +   
      selection +   
      fullText.substring(closeTagPos + BOLD_CLOSE_LENGTH);  
  
    newStart = openTagPos;  
    newEnd = newStart + selection.length;  
  } else {  
    newText =   
      before +   
      BOLD_OPEN +   
      selection +   
      BOLD_CLOSE +   
      after;  
  
    newStart = start + BOLD_OPEN_LENGTH;  
    newEnd = newStart + selection.length;  
  }  
  
  emit("update:model-value", newText);  
  
  nextTick(() => {  
    if (savedTextareaElement) {  
      savedTextareaElement.setSelectionRange(newStart, newEnd);  
      savedTextareaElement.focus();  
    }  
  });  
}  
  
function toggleItalic() {  
  // TEXTAREA VERSION - Manipulates HTML tags in plain text  
  if (!savedTextareaElement) return;  
    
  const start = savedTextareaElement.selectionStart || 0;  
  const end = savedTextareaElement.selectionEnd || 0;  
    
  if (start === end) return;  
  
  const fullText = props.modelValue;  
  const selection = fullText.substring(start, end);  
  const before = fullText.substring(0, start);  
  const after = fullText.substring(end);  
  
  const ITALIC_OPEN = "<i>";  
  const ITALIC_CLOSE = "</i>";  
  const ITALIC_OPEN_LENGTH = ITALIC_OPEN.length;  
  const ITALIC_CLOSE_LENGTH = ITALIC_CLOSE.length;  
  
const findItalicClosePosition = (): number => {  
    for (let i = end; i < fullText.length; i++) {  
      if (fullText.substring(i, i + ITALIC_CLOSE_LENGTH) === ITALIC_CLOSE) {  
        return i;  
      }  
    }  
    return -1;  
  }  
  
  const italicOpenPos = findItalicOpenPosition();  
  const italicClosePos = findItalicClosePosition();  
  
  if (italicOpenPos !== -1 && italicClosePos !== -1) {  
    // Caso: Ya tiene etiquetas <i>, las quitamos  
    const beforeOpen = fullText.substring(0, italicOpenPos);  
    const content = fullText.substring(italicOpenPos + ITALIC_OPEN_LENGTH, italicClosePos);  
    const afterClose = fullText.substring(italicClosePos + ITALIC_CLOSE_LENGTH);  
      
    const newText = beforeOpen + content + afterClose;  
    emit("update:model-value", newText);  
      
    nextTick(() => {  
      const newCursorPos = italicOpenPos + content.length;  
      if (savedTextareaElement) {  
        savedTextareaElement.focus();  
        savedTextareaElement.setSelectionRange(newCursorPos, newCursorPos);  
      }  
    });  
  } else {  
    // Caso: No tiene etiquetas, las agregamos  
    const newText = before + ITALIC_OPEN + selection + ITALIC_CLOSE + after;  
    emit("update:model-value", newText);  
      
    nextTick(() => {  
      const newCursorPos = start + ITALIC_OPEN_LENGTH + selection.length + ITALIC_CLOSE_LENGTH;  
      if (savedTextareaElement) {  
        savedTextareaElement.focus();  
        savedTextareaElement.setSelectionRange(newCursorPos, newCursorPos);  
      }  
    });  
  }  
}  
*/  
  
// ============================================  
// FUNCIONES PARA DIV CONTENTEDITABLE (ACTIVO)  
// ============================================  
  
/* function htmlToTextAndFormats(htmlContent: string): { text: string; formats: any[] } {  
  // Crear un elemento temporal para parsear el HTML  
  const tempDiv = document.createElement('div');  
  tempDiv.innerHTML = htmlContent;  
    
  let text = "";  
  const formats: any[] = [];  
  let pos = 0;  
    
  const append = (t: string) => {  
    if (!t) return;  
    text += t;  
    pos += t.length;  
  };  
    
  const processNode = (node: Node, parentFormats: { bold?: boolean; italic?: boolean } = {}) => {  
    if (node.nodeType === Node.TEXT_NODE) {  
      const content = node.textContent || "";  
      if (content) {  
        const start = pos;  
        append(content);  
          
        // Si hay formatos heredados, crear un objeto de formato  
        if (parentFormats.bold || parentFormats.italic) {  
          const fmt: any = { start, end: pos };  
          if (parentFormats.bold) fmt.bold = true;  
          if (parentFormats.italic) fmt.italic = true;  
          formats.push(fmt);  
        }  
      }  
      return;  
    }  
      
    if (node.nodeType === Node.ELEMENT_NODE) {  
      const el = node as HTMLElement;  
      const tag = el.tagName.toLowerCase();  
        
      // Detectar formatos del elemento actual  
      const currentFormats = { ...parentFormats };  
      if (tag === "b" || tag === "strong") currentFormats.bold = true;  
      if (tag === "i" || tag === "em") currentFormats.italic = true;  
        
      // Procesar hijos recursivamente  
      Array.from(el.childNodes).forEach(child => {  
        processNode(child, currentFormats);  
      });  
    }  
  };  
    
  Array.from(tempDiv.childNodes).forEach(node => {  
    processNode(node);  
  });  
    
  return { text: text.trim(), formats };  
} */

function htmlToTextAndFormats(htmlContent: string): { text: string; formats: any[] } {  
  const tempDiv = document.createElement('div');  
  tempDiv.innerHTML = htmlContent;  
    
  let text = "";  
  const formats: any[] = [];  
  let pos = 0;  
  
  function processNode(node: Node, currentFormats: { bold?: boolean; italic?: boolean } = {}) {  
    if (node.nodeType === Node.TEXT_NODE) {  
      const content = node.textContent || "";  
      if (content) {  
        const start = pos;  
        text += content;  
        pos += content.length;  
        
        // Solo crear formato si hay algún estilo activo
        if (currentFormats.bold || currentFormats.italic) {  
          formats.push({  
            start,  
            end: pos,  
            ...(currentFormats.bold && { bold: true }),  
            ...(currentFormats.italic && { italic: true })  
          });  
        }  
      }  
      return;  
    }  
      
    if (node.nodeType === Node.ELEMENT_NODE) {  
      const el = node as HTMLElement;  
      const tag = el.tagName.toLowerCase();  
        
      // Actualizar formatos según la etiqueta
      const newFormats = { ...currentFormats };  
      if (tag === "b" || tag === "strong") newFormats.bold = true;  
      if (tag === "i" || tag === "em") newFormats.italic = true;  
        
      // Procesar hijos recursivamente
      Array.from(el.childNodes).forEach(child => {  
        processNode(child, newFormats);  
      });  
    }  
  }  
    
  Array.from(tempDiv.childNodes).forEach(node => {  
    processNode(node);  
  });  
    
  return { text, formats };  
}

// Función para forzar la herencia de formatos durante la escritura
function getCurrentFormatState(): { bold: boolean; italic: boolean } {
  if (!editableDiv.value) return { bold: false, italic: false };
  
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return { bold: false, italic: false };
  
  const range = selection.getRangeAt(0);
  let element = range.startContainer as Element;
  
  // Si es un nodo de texto, subir al elemento padre
  if (element.nodeType === Node.TEXT_NODE) {
    element = element.parentElement!;
  }
  
  let bold = false;
  let italic = false;
  
  // Verificar si el elemento o sus padres tienen formato
  while (element && element !== editableDiv.value) {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'b' || tagName === 'strong') bold = true;
    if (tagName === 'i' || tagName === 'em') italic = true;
    element = element.parentElement!;
  }
  
  return { bold, italic };
}

function toggleBold() {    
  if (!editableDiv.value) return;    
      
  isInternalUpdate.value = true;    
      
  document.execCommand('bold', false, undefined);    
      
  nextTick(() => {    
    const htmlContent = editableDiv.value!.innerHTML;    
    const { text, formats } = htmlToTextAndFormats(htmlContent);

    console.log('🔵 RichTextEditor - Bold aplicado, formatos:', formats);
    /* emit('update:model-value', htmlContent);  */   
    const blockId = inspectorDrawer.selectedBlockId;
    if (blockId) {
      const currentBlock = inspectorDrawer.document[blockId];
      if (currentBlock?.type === 'Text') {
        inspectorDrawer.setDocument({
          [blockId]: {
            ...currentBlock,
            data: {
              ...currentBlock.data,
              props: {
                ...currentBlock.data.props,
                text: text,
                formats: formats
              }
            }
          }
        });
      }
    }
        
    setTimeout(() => {    
      isInternalUpdate.value = false;    
    }, 100);    
  });    
}    
  
function toggleItalic() {    
  if (!editableDiv.value) return;    
      
  isInternalUpdate.value = true;    
      
  document.execCommand('italic', false, undefined);    
      
  nextTick(() => {    
    const htmlContent = editableDiv.value!.innerHTML;   
    const { text, formats } = htmlToTextAndFormats(htmlContent); 

    console.log('🔵 RichTextEditor - Italic aplicado, formatos:', formats);
    
    const blockId = inspectorDrawer.selectedBlockId;
    if (blockId) {
      const currentBlock = inspectorDrawer.document[blockId];
      if (currentBlock?.type === 'Text') {
        inspectorDrawer.setDocument({
          [blockId]: {
            ...currentBlock,
            data: {
              ...currentBlock.data,
              props: {
                ...currentBlock.data.props,
                text: text,
                formats: formats
              }
            }
          }
        });
      }
    }
        
    setTimeout(() => {    
      isInternalUpdate.value = false;    
    }, 100);    
  });    
}  
 
function handleContentChange() {  
  if (!editableDiv.value || isInternalUpdate.value) return;  
    
  isInternalUpdate.value = true;  
  saveCursorPosition();  
    
  const htmlContent = editableDiv.value.innerHTML;  
  const { text, formats } = htmlToTextAndFormats(htmlContent); 
  
  console.log('🔵 RichTextEditor - Formatos detectados:', formats);
    
  // Actualizar store
  const blockId = inspectorDrawer.selectedBlockId;
  if (blockId) {
    const currentBlock = inspectorDrawer.document[blockId];
    if (currentBlock?.type === 'Text') {
      inspectorDrawer.setDocument({
        [blockId]: {
          ...currentBlock,
          data: {
            ...currentBlock.data,
            props: {
              ...currentBlock.data.props,
              text: text,
              formats: formats
            }
          }
        }
      });
    }
  }
    
  nextTick(() => {  
    restoreCursorPosition();  
    isInternalUpdate.value = false;  
  });  
}

function saveCursorPosition() {
  if (!editableDiv.value) {
    console.log('❌ saveCursorPosition: editableDiv is null');
    return;
  }
  
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    console.log('❌ saveCursorPosition: no selection');
    return;
  }
  
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(editableDiv.value);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  lastCursorPosition.value = preCaretRange.toString().length;
  
  console.log('💾 saveCursorPosition: saved position', lastCursorPosition.value, {
    startContainer: range.startContainer,
    startOffset: range.startOffset,
    endContainer: range.endContainer,
    endOffset: range.endOffset
  });
}

// Agregar handlers de focus/blur  
function handleFocus() {  
  isActivelyEditing.value = true;  
}  
  
function handleBlur() {  
  setTimeout(() => {  
    isActivelyEditing.value = false;  
  }, 150);  
}  

// Y restoreCursorPosition con logs
function restoreCursorPosition() {
  if (!editableDiv.value) {
    console.log('❌ restoreCursorPosition: editableDiv is null');
    return;
  }
  
  const selection = window.getSelection();
  if (!selection) {
    console.log('❌ restoreCursorPosition: no selection');
    return;
  }
  
  console.log('🔄 restoreCursorPosition: restoring to position', lastCursorPosition.value);
  
  // Caso especial: si la posición es 0, ir al inicio
  if (lastCursorPosition.value === 0) {
    const range = document.createRange();
    range.setStart(editableDiv.value, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    console.log('📍 Moved to start (position 0)');
    return;
  }
  
  let charIndex = 0;
  const nodeStack = [editableDiv.value];
  let node: Node | null = null;
  let found = false;
  
  while (!found && (node = nodeStack.pop()!)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length || 0;
      const nextCharIndex = charIndex + textLength;
      
      console.log('🔍 Checking text node:', {
        charIndex,
        nextCharIndex,
        target: lastCursorPosition.value,
        textLength,
        textContent: node.textContent?.substring(0, 50) + '...'
      });
      
      if (lastCursorPosition.value <= nextCharIndex) {
        const offset = lastCursorPosition.value - charIndex;
        const range = document.createRange();
        range.setStart(node, Math.min(offset, textLength));
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        found = true;
        console.log('✅ Position restored to text node with offset', offset);
      }
      charIndex = nextCharIndex;
    } else {
      // Para elementos no-texto, procesar hijos
      const children = node.childNodes;
      for (let i = children.length - 1; i >= 0; i--) {
        nodeStack.push(children[i]);
      }
    }
  }
  
  if (!found) {
    console.warn('⚠️ Position not found, moving to end');
    // Mover al final
    const range = document.createRange();
    range.selectNodeContents(editableDiv.value);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
  
function insertVariable(variableKey: string) {  
  console.log('🔧 insertVariable called with:', variableKey);
  
  if (!editableDiv.value) {  
    console.error("❌ editableDiv is null");  
    return;  
  }  

  // 1. Enfocar el elemento editable
  editableDiv.value.focus();
  console.log('✅ editableDiv focused');
  
  // 2. Obtener la selección actual ANTES de cualquier operación
  const selection = window.getSelection();
  console.log('🎯 Current selection:', {
    selection,
    rangeCount: selection?.rangeCount,
    isCollapsed: selection?.isCollapsed,
    anchorNode: selection?.anchorNode,
    anchorOffset: selection?.anchorOffset,
    focusNode: selection?.focusNode,
    focusOffset: selection?.focusOffset
  });
  
  if (!selection || selection.rangeCount === 0) {
    console.warn('⚠️ No selection available, checking cursor position');
    
    // Intentar restaurar la posición guardada
    if (lastCursorPosition.value > 0) {
      console.log('🔄 Restoring cursor position:', lastCursorPosition.value);
      restoreCursorPosition();
      // Obtener la selección nuevamente después de restaurar
      const newSelection = window.getSelection();
      if (newSelection && newSelection.rangeCount > 0) {
        selection = newSelection;
        console.log('✅ Selection restored');
      }
    }
    
    if (!selection || selection.rangeCount === 0) {
      console.error('❌ Still no selection after restore, inserting at end');
      // Fallback: insertar al final
      const variableText = `{${variableKey}}`;
      editableDiv.value.innerHTML += variableText;
      
      isInternalUpdate.value = true;  
      nextTick(() => {  
        emit("update:model-value", editableDiv.value?.innerHTML || '');  
        setTimeout(() => {  
          isInternalUpdate.value = false;  
        }, 100);  
      });  
      showVariablesDropdown.value = false;
      return;
    }
  }
  
  const range = selection.getRangeAt(0);
  console.log('📏 Range details:', {
    startContainer: range.startContainer,
    startOffset: range.startOffset,
    endContainer: range.endContainer,
    endOffset: range.endOffset,
    commonAncestorContainer: range.commonAncestorContainer,
    collapsed: range.collapsed
  });
  
  // 3. Verificar que el range está dentro del editableDiv
  const isInEditable = editableDiv.value.contains(range.commonAncestorContainer);
  console.log('📍 Is selection inside editableDiv?', isInEditable);
  
  if (!isInEditable) {
    console.warn('⚠️ Selection not in editableDiv, moving to end');
    // Mover selección al final del contenido
    range.selectNodeContents(editableDiv.value);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    console.log('✅ Moved selection to end');
  }
  
  // 4. Intentar con execCommand primero (más confiable)
  try {
    console.log('🔄 Attempting execCommand insert');
    const variableText = `{${variableKey}}`;
    const success = document.execCommand('insertText', false, variableText);
    console.log('✅ execCommand result:', success);
    
    if (success) {
      isInternalUpdate.value = true;  
      nextTick(() => {  
        const newValue = editableDiv.value?.innerHTML || '';  
        emit("update:model-value", newValue);  
        console.log('📤 Emitted update with new value');
        setTimeout(() => {  
          isInternalUpdate.value = false;  
        }, 100);  
      });  
      showVariablesDropdown.value = false;
      return;
    }
  } catch (error) {
    console.error('❌ execCommand failed:', error);
  }
  
  // 5. Fallback: método manual con Range
  console.log('🔄 Falling back to manual range insertion');
  try {
    const variableText = `{${variableKey}}`;
    const textNode = document.createTextNode(variableText);
    
    console.log('📝 Inserting text node:', variableText);
    range.deleteContents();
    range.insertNode(textNode);
    
    // Mover el cursor después de la variable insertada
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    console.log('✅ Manual insertion completed');
    
    isInternalUpdate.value = true;  
    nextTick(() => {  
      const newValue = editableDiv.value?.innerHTML || '';  
      emit("update:model-value", newValue);  
      setTimeout(() => {  
        isInternalUpdate.value = false;  
      }, 100);  
    });  
  } catch (error) {
    console.error('❌ Manual insertion failed:', error);
    
    // Último fallback: insertar al final
    console.warn('🔄 Last resort: inserting at end');
    const variableText = `{${variableKey}}`;
    editableDiv.value.innerHTML += variableText;
    
    isInternalUpdate.value = true;  
    nextTick(() => {  
      emit("update:model-value", editableDiv.value?.innerHTML || '');  
      setTimeout(() => {  
        isInternalUpdate.value = false;  
      }, 100);  
    });  
  }
  
  showVariablesDropdown.value = false;
  console.log('🎉 insertVariable completed');
}

function textWithFormatsToHtml(text: string, formats: any[]): string {  
  if (!formats || formats.length === 0) return text;  
    
  // Crear array de caracteres para construir el HTML  
  const chars = text.split('');  
  const openTags: { pos: number; tags: string[] }[] = [];  
  const closeTags: { pos: number; tags: string[] }[] = [];  
    
  // Procesar cada formato  
  formats.forEach(fmt => {  
    const tags: string[] = [];  
    if (fmt.bold) tags.push('b');  
    if (fmt.italic) tags.push('i');  
      
    if (tags.length > 0) {  
      openTags.push({ pos: fmt.start, tags });  
      closeTags.push({ pos: fmt.end, tags: [...tags].reverse() });  
    }  
  });  
    
  // Ordenar tags por posición  
  openTags.sort((a, b) => a.pos - b.pos);  
  closeTags.sort((a, b) => a.pos - b.pos);  
    
  // Construir HTML insertando tags  
  let html = '';  
  let openIdx = 0;  
  let closeIdx = 0;  
    
  for (let i = 0; i <= text.length; i++) {  
    // Insertar tags de cierre en esta posición  
    while (closeIdx < closeTags.length && closeTags[closeIdx].pos === i) {  
      closeTags[closeIdx].tags.forEach(tag => {  
        html += `</${tag}>`;  
      });  
      closeIdx++;  
    }  
      
    // Insertar tags de apertura en esta posición  
    while (openIdx < openTags.length && openTags[openIdx].pos === i) {  
      openTags[openIdx].tags.forEach(tag => {  
        html += `<${tag}>`;  
      });  
      openIdx++;  
    }  
      
    // Insertar el carácter actual  
    if (i < text.length) {  
      html += chars[i];  
    }  
  }  
    
  return html;  
}
  
// ============================================  
// WATCHERS  
// ============================================  

watch(() => {    
  const blockId = inspectorDrawer.selectedBlockId;    
  if (!blockId) return null;    
  const block = inspectorDrawer.document[blockId];    
  return { text: block?.data?.props?.text || '', formats: block?.data?.props?.formats || [] };    
}, (newData) => {    
  if (!newData || isActivelyEditing.value || isInternalUpdate.value || !editableDiv.value) return;    
  // ...  
}, { deep: true, immediate: true });  
  
// POR ESTE:  
watch([() => props.modelValue, () => props.formats], ([newText, newFormats]) => {    
  if (isActivelyEditing.value || !editableDiv.value) return;    
      
  const htmlContent = textWithFormatsToHtml(newText, newFormats || []);    
      
  if (editableDiv.value.innerHTML !== htmlContent) {    
    const wasFocused = document.activeElement === editableDiv.value;  
      
    if (wasFocused) saveCursorPosition();  
    editableDiv.value.innerHTML = htmlContent;    
      
    if (wasFocused) {  
      nextTick(() => restoreCursorPosition());  
    }  
  }    
}, { deep: true, immediate: true });

watch(blockProps, (newProps) => {
  if (!editableDiv.value || !newProps || isInternalUpdate.value) return;

  const { text, formats } = newProps;
  const htmlContent = textWithFormatsToHtml(text, formats);

  console.log('🔵 RichTextEditor - Sincronizando formatos:', formats);
  
  if (editableDiv.value.innerHTML !== htmlContent) {
    const wasFocused = document.activeElement === editableDiv.value;
    if (wasFocused) saveCursorPosition();
    
    editableDiv.value.innerHTML = htmlContent;
    
    if (wasFocused) {
      nextTick(() => restoreCursorPosition());
    }
  }
}, { deep: true, immediate: true });


defineExpose({    
  getCurrentSelection,    
  getSelectedText: () => selectedText.value    
});  
</script>   
              
<style scoped>  
.rich-text-editable {  
  width: 100%;  
  padding: 0.5rem 0.75rem;  
  border: 1px solid #d1d5db;  
  border-radius: 0.375rem;  
  font-family: inherit;  
  font-size: 0.875rem;  
  line-height: 1.5;  
  outline: none;  
  transition: border-color 0.2s;  
  white-space: pre-wrap;  
  word-wrap: break-word;  
}  
  
.rich-text-editable:focus {  
  border-color: var(--ui-primary);  
  box-shadow: 0 0 0 1px var(--ui-primary);  
}  
  
.rich-text-editable:empty:before {  
  content: attr(data-placeholder);  
  color: #9ca3af;  
  pointer-events: none;  
}  
</style>